/* 1.4 Memory
Of the 3K bytes of RAM on the controller card, the DOS uses 2K from #2000 to #27FF, 
leaving 1K from #3C00 to #3FFF available to the user. 
The DOS ROM is situated from #E000 to #EFFF.

1.5 Introduction to Floppy Disks
The floppy disks used by the Atom Disk Pack are 5.25" in diameter and 
should be single-sided, single-density and soft sectored. 
They are plastic disks coated with metal oxide in the same way as magnetic tapes. 
Before new disks can be used on the Atom Disk Pack they must be prepared by "formatting" 
them. This process divides the disk up into sectors of 256 bytes each. 

FORMAT
Initialises a disc to the Acorn 40-track soft-sectored format. All new discs must be formatted before they can be used. On running, the program displays a prompt message and waits for YES to be entered (without RETURN). Before replying the utilities disc should be replaced by the disc to be formatted. The program initialises the entire disc, clearing the catalogue, and then verifies each sector.

*/

var floppybuffer=""

class FloppyDisk {
	discwrite = false
	discread  = false
	discready= false
	writeprot = false
	motoron=false;
	
	ct=0; // current track
	cs=0; // current sector
	cb=0; // current byte
	
	constructor(tracks = 40, sectors = 10, bytesPerSector = 256) {
		this.tracks   = tracks;
		this.sectors  = sectors;
		this.bytesPerSector = bytesPerSector;

		this.data     = 0; //this.init();
		this.discready= false;
		this.motoron  = false;
	}

	init() {
		//initialise blank diskette
		const disk = [];
		for (let i = 0; i < this.tracks; i++) {
		  const track = [];
		  for (let j = 0; j < this.sectors; j++) {
			track.push(new Array(this.bytesPerSector).fill(0));
		  }
		  disk.push(track);
		}
		return disk;
	}
 
	getdiskcinfo() {
		return 	this.ct,this.cs, this.cb
	}
		
	setdiskcinfo(t,s) {
		if (s >= this.sectors || t>= this.tracks) 
			return;
		this.ct=t;
		this.cs=s;
		this.cb=0;
	}

	getbyte() {
		//check cb <256 && 
		if (this.cb>=this.bytesPerSector) 
			return 0xff
		
		let b=this.data[this.ct][this.cs][this.cb]
		this.cb += 1
		return b
	}

	putbyte(b) {
		//check cb <256 
		if (this.writeprot==true || this.cb>=this.bytesPerSector) 
			return;
		
		this.data[this.ct][this.cs][this.cb] = b
		this.cb += 1
	}
  
	dumpDisk() {
		var op="DISK\n"
		for (let i = 0; i < this.tracks; i++) {
		  op += "T" + i + ": "
		  for (let j = 0; j < this.sectors; j++) {
				op += "S" + j + ": " 
				for (let k = 0; k < this.bytesPerSector; k++) {
					op += this.data[i][j][k] + " "
				}
				op += "\n"	
		  }
		  op += "\n"
		}
		return op;
	}

	bloadDisk(contents) {
		const view = new Uint8Array(contents)
		
		if (this.data==0) {
			this.data = this.init();
		}
		
		if (view.byteLength<this.tracks*this.sectors*this.bytesPerSector)
			return -1;

		let n=0
		for (let i=0; i<this.tracks; i++)
		{
			for (let j = 0; j < this.sectors; j++) 
			{
				for (let k = 0; k < this.bytesPerSector; k++) 
				{
					this.data[i][j][k] = view[n]
					n=n+1
				}
			}
		}
		this.discready=true
		//this.discread=true//???
		return 0; 
	}
  
	loadDisk() {
		str=floppybuffer
		if (str=="") return ;
		
		if (this.data==0) {
			this.data = this.init();
		}
		
		if (str.substr(0,1)=="#") {
			str=str.substr(1)
			this.writeprot=true
		}
		else
			this.writeprot=false			
		
		let recs=str.split("\n") //40 tracks (each of 10 sects contain 256 bytes)

		if (recs.length != 41) 
			return -1  //fail
			
		for (let i=0; i<recs.length-1; i++)
		{
			var dtxt=recs[i].split(" ")  //2560 (each of 10 sects contain 256 bytes)
			if (dtxt.length != 2561)
				return -2 //fail
			
			for (let j = 0; j < 10; j++) 
			{
				for (let k = 0; k < 256; k++) 
				{
					this.data[i][j][k] = dtxt[j*256+k]
				}
			}
		}	
		this.discready=true
		//this.discread=true//???
		return 0
	}
		  
	saveDisk() {
		let op=""
		for (let i = 0; i < this.tracks; i++) {
		  for (let j = 0; j < this.sectors; j++) {
				for (let k = 0; k < this.bytesPerSector; k++) {
					op += this.data[i][j][k] + " "
				}	
		  }
		  op += "\n"
		}		
		return op;
	}
	
	eject() {
		//close and free mem
		this.data=0
		this.ct=0
		this.cs=0
		this.cb=0
		this.discwrite=false
		this.discwrite=false
		this.discready=false
	}

	seek(track)	{
		console.log("FD: seek track"+track);
		this.ct=track;
	}
		
	writesector(sector, track)	{
		console.log("FD: write sector disk");
		if (this.discready != true)
			return
		
		this.setdiskcinfo(track,sector)
		this.discwrite=true
	}
	
	readsector(sector, track) 	{
		console.log("FD: read sector disk :" + sector + "," + track);
		if (this.discready != true)
			return

		this.setdiskcinfo(track,sector)
		this.discread=true	
	}

	spinup() {
		console.log("FD: spinup");
	}
	
	spindown() {
		console.log("FD: spindown");
	}

	readaddress(track)	{
		console.log("FD: read address:" + track);
	}
	
	format(track)	{
		console.log("FD: format");
	}  
}
	