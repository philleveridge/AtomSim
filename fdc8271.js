
/****************************************************************************
// FDC emulation !!
****************************************************************************/

var ptime=0  //event timer for poll of FDC for updates
var driveready=0


function put_byte_8271(addr, v) {
	//debug_out("8271 VIA I/0 write address - "+hex4(addr)+" <= " + hex2(v))
	return fdc8271.write(addr,v)
}

function get_byte_8271(addr) {
	//debug_out("8271 VIA I/0 read address - "+hex4(addr))
	return fdc8271.read(addr)
}


class FDController {
	result	 = 0
	status   = 0x00;
	result   = 0x00;
	command  = 0xff;
	data     = 0xff;
	
	params   = [];
	paramnum = 0;
	paramreq = 0;
	
	csec     = 0;
	lsec	 = 0;
	written  = 0;
	phase    = 0; // comand, execution, result phases
	verify   = 0;
	
	drive    = 0;  // FloppyDisk - change to array at some point

	count80s   =0; // bug loop detector
	event_timer=0; // trigger callback
		
	constructor(d = new FloppyDisk()) {
		this.drive=d;
	}
	
	reset() {	
		debug_out("FDC 8271 Reset");
		this.paramnum = 0
		this.paramreq = 0;		
		this.status   = 0;
		this.command  = 0xFF;

		this.rtrk=0
		this.event_timer = 0;
		this.motoron=false;

	}
	
	nmi_rq() {
	    //if (!this.active) return;
		debug_out("NMI");
		if (this.status & 8)
			nmi_int = 1;
		else
			nmi_int = 0;
	}
	
	seek() {
		debug_out("SEEK");
		this.active=true
		
		let diff = this.params[0] - this.drive.ct ; 
		this.rtrk += diff;	
		this.drive.seek(this.rtrk);
	}
	getparam() {
		let x = this.command
		debug_out("PARAM "+x);
		if (x==0x2c) return 0;
		if ((x==0x29) || (x==0x3d)) return 1;
		if (x==0x3a) return 2;		
		if ((x==0x13) || (x==0x0b) || (x==0x1b) || (x==0x1f)) return 3;	
		if (x==0x35) return 4;		
		if (x==0x23) return 5;
		return 0;	
	}	
	write(addr, v) {	
				
		if ((addr &0x07) == 0) {
			//COMMAND REGISTER (WRITE)
			debug_out("8271 write command "+hex2(v))

			if (this.status &0x80)
				return
			
			this.command = v &0x3f //mask Bit 5- Bit 0)
			
			if (this.command == 0x17) {
				this.command = 0x13
				debug_out("8271 command "+hex2(this.command))
			}

			//The highest two bits (bit 7 and bit 6) determine 
			//which drive the command is intended for. 
			let drivesel = v >> 6; 
			
			if (drivesel & 2)
			{
				debug_out("8271 only drive 0 supported")
			}

			this.paramnum = 0;
			this.paramreq = this.getparam();	

			this.status = 0x80;	

			// No parmeters required, excute it immediatly.
			if (!this.paramreq) {
				if (this.command == 0x2c) {
					/* DRIVE STATUS REGISTER
					Bit 6 : Drive 1 ready
					Bit 5 : Write fault
					Bit 4 : Index

					Bit 3 : Diskette write protect
					Bit 2 : Drive 0 ready
					Bit 1 : Head is on 
					*/
					this.status = 0x18
					this.result = 0

					if (this.drive.discready==true)
						this.result |= 0x04; //drive 0 ready
					
					if (this.drive.writeprot==true)
						this.result |= 0x08; //drive 0 write prot
										
					debug_out("8271: drive Status "+this.result);
				}
				else {
					this.result = 0x10
					this.status = 0x10
					this.nmi_rq()
					this.event_timer = 0;
					debug_out("8271: unknown command "+this.command);
				}
			}				
		}
		else if ((addr &0x07) == 1) {	
			//PARAMETER REGISTER (WRITE)
			debug_out("8271 write parameter "+hex2(v))

			if (this.paramnum < 5) {
				this.params[this.paramnum] = v;
				this.paramnum += 1
			}
			
			if (this.paramnum == this.paramreq)
			{
				if (this.command == 0x0b) // Write sector
				{
					debug_out("8271 parameter write sec")
					this.lsec = this.params[2] & 31;
					this.csec = this.params[1];
					this.drive.spinup();
					this.phase = 0;
					if (this.drive.ct != this.params[0])
						this.seek();

					this.event_timer = 200;
				}
				else if (this.command == 0x13) // read sector
				{
					debug_out("8271 parameter read sec")
					this.lsec = this.params[2] & 31;
					this.csec = this.params[1];
					this.drive.spinup();
					this.phase = 0;
					if (this.drive.ct != this.params[0]) 
						this.seek();

					this.event_timer = 200;
				}
				else if (this.command == 0x1f) // verify sector
				{
					debug_out("8271 parameter ver sec")
					this.lsec = this.params[2] & 31;
					this.csec = this.params[1];
					this.drive.spinup();
					this.phase = 0;
					if (this.drive.ct != this.params[0])  
						this.seek();

					this.event_timer = 200;
					this.verify = 1;
				}		
				else if (this.command == 0x1b) // read id
				{
					debug_out("8271 parameter read id")
					this.lsec = this.params[2] & 31;
					this.drive.spinup();
					this.phase = 0;
					if (this.drive.ct != this.params[0])  
						this.seek();

					this.event_timer = 200;
				}		
				else if (this.command == 0x23) // format track
				{
					debug_out("8271 parameter format")
					drive.spinup();
					this.phase = 0;
					if (this.drive.ct != this.params[0]) 
						this.seek();
					this.event_timer = 200;
				}
				else if (this.command == 0x29) // seek
				{
					debug_out("8271 parameter seek")
					this.seek();
					this.drive.spinup();	
					this.status = 0x10  //?					
				}
				else if (this.command == 0x35) // specify
				{
					debug_out("8271 parameter spec")
					this.status = 0;
				}
				else if (this.command == 0x3a) // write special reg
				{
					debug_out("8271 parameter write spec reg")
					this.status = 0;
					if (this.params[0]==0x12) // surface 0 current track
					{
						this.drive.ct= v; 
					}
					else if (this.params[0]==0x17) // mode register
					{
							// bit 0 = 1  - DMA/non DMA = shoudl equal x01
							// bit 1 = 0  - single double actuator
					}
					else if (this.params[0]==0x1A)  // surface 1 current track
					{
					}
					else if (this.params[0]==0x23) // drive control output port
					{ 
						//first nibble of this code selects the drive, 
						//second nibble starts the motor and places the head on the disk. 
						debug_out("8271 parameter write spec reg " + hex2(this.params[1]))
						
						this.drive.motoron=true;
						
					}
					else {
						this.result = 0x18;
						this.status = 0x18;
						this.nmi_rq();
						this.event_timer = 0;
					}
				}
				else if (this.command == 0x3d) // read special reg
				{
					debug_out("8271 parameter read spec reg")
					this.result = 0x0;
					this.status = 0x10;

					if (this.params[0]==0x06)      // scan sector number 
						this.result = 0;
					else if (this.params[0]==0x12)  // surface 0 current track
						this.result = this.drive.ct; 
					else if (this.params[0]==0x1A)  // surface 1 current track
						this.result = 0; 
					else if (this.params[0]==0x23)  // drive control output port
						this.result = 0; 
					else {
						this.result = 0x18;
						this.status = 0x18;
						this.nmi_rq();
						this.event_timer = 0;				
					}
				}
				else
				{
					this.result = 0x18;
					this.status = 0x18;
					this.nmi_rq_rq();
					this.event_timer = 0;				
				}
			}
		}
		else if ((addr &0x07) == 2) {
			debug_out("8271 write command - reset reg")
			if (v & 1)
				this.reset();
		}
		else if ((addr &0x07) == 4) {
			debug_out("8271 write data reg "+hex2(v))
			this.data = v;
			this.written = 1;
			this.status &= ~0xC;
			this.nmi_rq();
		}	
		return 	
	}
	
	read(addr) {
		if ((addr &0x07) == 0) {
			/*
			STATUS REGISTER. (READ)
			The status register indicates whether the FDC is working correctly or is ready.
			bit D7=1 : FDC has not yet completed its command. This bit is set when a command is set in the command register. 
			bit D6=1 : Command register is filled. This bit is 1 as soon as a command is set in the command register. It is cleared again when the FDC starts executing the command.
			bit D5=1 : Parameter register is full. This bit is set as soon as a parameter is set in the register and is cleared as soon as the FDC has accepted the parameter.
			bit D4=1 : There is a result in the result register.  
			bit D3=1 : Interrupt request bit. This bit is set because the FDC requires the result register 
			bit D2=1 : NON-DMA request.(in DMA mode)
			bit D1=1 : Always 0.
			bit D0=1 : Always 0.
			*/			
			if (this.status==128) {
				if (this.count80s==0)
					debug_out("8271 read status:" + hex2(this.status))
				this.count80s +=1
				if (this.count80s>100) {
					debug_out("in a loop?")		
					this.count80s =0					
				}
			}
			else {
				debug_out("8271 read status:" + hex2(this.status))
				this.count80s =0
			}
			
			return this.status
		}
		else if ((addr &0x07) == 1) {
			/*
			RESULT REGISTER.
			The result of a command is stored in the result register. Bits D0, D6, and D7 are not used and are always 0. Bit 5 is used for the instruction DELETE DATA FOUND, but this instruction is not used by the ATOM and will therefore always be zero. The status of bits D1 to D4 are only important for the ATOM and we know this result as the DISK-ERROR.
			Bits 4 and 3 indicate the type of error, namely:
			00  command completed without error.
			01  system error that may be recovered.
			10  operation error that cannot be recovered.
			11  program or hardware error.
			By testing the type of error, it can be decided whether the program should be stopped or if another attempt should be made. The ATOM does not perform this test, but only tests for errors 12 and 16, where it stops via a break, otherwise it makes nine more attempts.
			The meaning of the result register for the ATOM is as follows:
			bit 7 6 5 4 3 2 1 0
			disk error
			00  0 0 0 0 0 0 0 0  command executed without error.
			02 	0 0 0 0 0 0 1 0  scan not equal (should not occur).
			04 	0 0 0 0 0 1 0 0  scan are not equal.
			08 	0 0 0 0 1 0 0 0  clock error.
			0A 	0 0 0 0 1 0 1 0  late DMA.
			0B 	0 0 0 0 1 1 0 0  ID CRC error
			0E 	0 0 0 0 1 1 1 0  data CRC error.
			10 	0 0 0 1 0 0 0 0  drive not ready
			12 	0 0 1 0 0 0 1 0  Disk write protect.
			14 	0 0 0 1 0 1 0 0  track 0 not found.
			16 	0 0 0 1 0 1 1 0  write error
			18 	0 0 0 1 1 0 0 0  sector not found.
			*/
			debug_out("8271 read result reg:" + hex2(this.result))

			this.status &= ~0x18;
			this.nmi_rq();
			let val = this.result;
			this.result = 0;
			return val;
		}
		else if ((addr &0x07) == 4) {       /*Data register*/
			debug_out("8271 read data  reg:" + hex2(this.data))
			this.status &= ~0xC;
			this.nmi_rq();
			return this.data;
		}	
		else
			return 0
	}
	
	callback() {
		this.event_timer = 0;		
		if (this.command == 0x0b) // Write
		{		
			if (this.phase==0)
			{
				this.drive.writesector(this.csec, this.params[0]);
				this.phase = 1;

				this.status = 0x8C;
				this.result = 0;
				this.nmi_rq();
				return;
			}
			this.lsec -= 1
			if (this.lsec==0)
			{
				this.status = 0x18;
				this.result = 0;
				this.nmi_rq();
				this.verify = 0;
				return;
			}
			this.csec += 1;
			this.drive.writesector(this.csec, this.params[0]);
			this.status = 0x8C;
			this.result = 0;
			this.nmi_rq();	
		}
		else if((this.command == 0x013) || (this.command == 0x01f )) // Read or verify
		{
			if (this.phase==0)
			{
				this.drive.readsector(this.csec, this.params[0]);
				this.phase = 1;
				return;
			}
			this.lsec -= 1;
			if (this.lsec==0)
			{
				this.status = 0x18;
				this.result = 0;
				this.nmi_rq();
				this.verify = 0;
				return;
			}
			this.csec += 1;
			this.drive.readsector(this.csec, this.params[0]);
		}
		else if (this.command == 0x1b)  // read id
		{
			if (this.phase==0)
			{
				this.drive.readaddress(this.params[0]);
				this.phase = 1;
				return;
			}
			this.lsec -= 1;
			if (this.lsec==0)
			{
				this.status = 0x18;
				this.result = 0;
				this.nmi_rq();
				return;
			}
			this.csec += 1;
			this.drive.readaddress(this.params[0]);

		}
		else if (this.command == 0x23)  // format
		{
			if (!this.phase)
			{
				this.drive.writesector(this.csec, this.params[0]);
				this.phase = 1;

				this.status = 0x8C;
				this.result = 0;
				this.nmi_rq();
				return;
			}
			if (this.phase == 2)
			{
				this.status = 0x18;
				this.result = 0;
				this.nmi_rq();
				this.verify = 0;
				return;
			}
			this.drive.disc_format(this.params[0]);
			this.phase = 2;
		}
		else if (this.command == 0x29) // seek
		{
			this.drive.seek(this.params[0])
			
			this.status = 0x18;
			this.result = 0;
			this.nmi_rq();
		}
		else
		{
			debug_out("Callback- ?command "+hex2(this.command));
		}
	}

	putdata(dat) {
		if (this.verify!=0)
			return;
		this.data = dat;
		this.status = 0x8C;
		this.result = 0;
		this.nmi_rq();
	}

	getdata(last) {
		//debug_out("Disc get data " + this.drive.cb + " " +last);
		if (this.written==0)
			return -1;
		if (!last)
		{
			this.status = 0x8C;
			this.result = 0;
			this.nmi_rq();
		}
		this.written = 0;
		return this.data;
	}

	finishread() {
		this.event_timer = 200;
	}

	notfound() {
		this.result = 0x10;
		this.status = 0x18;
		this.nmi_rq();
		this.event_timer = 0;
	}

	datacrcerror() {
		this.result = 0x0E;
		this.status = 0x18;
		this.nmi_rq();
		this.event_timer = 0;
	}

	headercrcerror() {
		this.result = 0x0C;
		this.status = 0x18;
		this.nmi_rq();
		this.event_timer = 0;
	}

	writeprotect() {
		this.result = 0x12;
		this.status = 0x18;
		this.nmi_rq();
		this.event_timer = 0;
	}
	
	poll_hw()
	{
		//if (this.drive.motoron ==false) return;
		
		ptime++;
		if (ptime < 16 || this.drive==0)
			return;
		ptime = 0;
		
		if (this.drive.motoron ==false) return;

		
		if (this.drive.discready ==false)			
		{
			driveready += 1
			if (driveready >1000) {
				debug_out("Drive not available");
				this.notfound()
				driveready=0
			}
		}

		if (this.drive.discread )
		{
			debug_out("Read " + this.drive.cb);
			this.putdata(this.drive.getbyte())
			if (this.drive.cb == 256)
			{
				this.drive.discread = false;
				this.finishread();
			}
		}
		if (this.drive.discwrite)
		{
			c = this.getdata(this.drive.cb == 255);
			debug_out("Write data :"+this.drive.cb+" = "+c);
			if (c == -1)
			{
				debug_out("Data overflow!");
				return
			}
			this.drive.putbyte(c)
			if (this.drive.cb == 256)
			{
				this.drive.discwrite = false;
				this.finishread();
			}
		}
	}
}

fdc8271 = new FDController();

