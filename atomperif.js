	/*  KEYBOARD EMULATION / 8522 */
	
var ATOMkbd 	= ""

/*  KEYBOARD EMULATION / 8522
*/
const aCTRL  = 0b01000000  // low for active (PORTB)
const aSHFT  = 0b10000000  // low for active (PORTB)
const aROW   = 0b00111111  // high for active ?(PORTB)
const aREPT  = 0b01000000  // low for active? (PORTC)			

var REPT= 0xFF
var SHFT= 0xFF
var CTRL= 0xFF

PORTA=0		// contents of PORT
PORTB=0		// contents of PORT
PORTC=0		// contents of PORT
DDRB =0		// contents of PORT
GM=0		// graphics mode
KR=0		// key row being scanned
keycnt=0    // debounce counter

const PB = [
	"?????^]\\[ ",
	"3210??????",
	"-,;:987654",
	"GFEDCBA@/.",
	"QPONMLKJIH",
	"?ZYXWVUTSR"]
// ctrl PB6, shift PB7 (Rept PC6)

const shifted =["!\"#$%&'()=+*<>?|",
				"123456789-;:,./\\"]

//convert ASCII to ATOM row,col				
function cvtkbd(ch) 
{			
	if (ch==8) {
		return [1,4]
	}
	if (ch==13) {
		return [1,6]
	}
	if (ch==27) {
		return [5,0]
	}	
	if (ch==537 || ch==539) 
	{
		if (ch==537) SHFT=~aSHFT
		return [0,3]
	}
	if (ch==538 || ch==540) 
	{
		if (ch==540) SHFT=~aSHFT
		return [0,2]
	}	
	if (ch==400)  // CTRL
	{
		CTRL = ~aCTRL
		return ""
	}	
	if (ch==401)  // BRK
	{
		// reset every thing  TODO
		return ""
	}
	//if (ch==91) { return [8,0]}
	
	if (ch >=65 && ch <91)
	{
		SHFT=~aSHFT /* set low active */
	}
	if (ch >=97 && ch <=123) {
		ch = ch-32; // lowercase -> upper case
		SHFT=0xff
	}
	
	c=String.fromCharCode(ch)
	debug_out("ch ("+c+")")
	
	if (shifted[0].includes(c)) {
		c = shifted[1].charAt(shifted[0].indexOf(c))
		SHFT=~aSHFT /* set low active */		
	}
		
	var i,j
	for (i=0; i<PB.length; i++)
	{
		var st=PB[i]
		for (j=0; j<st.length; j++)
		{
			if (st[j]==c) 
				return [i,j]
		}
	}			
	debug_out("no character match ("+c+")")
	return ""
}

var Tapeplay=false
var tapecnt=0
var tapetime=0
var AFile=[]

var bitstream=""
var tCLK=0

function get_byte_8255(addr) 
{	
	// PPIA I/O device
	addr = addr & 0x3
	
	if (ATOMkbd != "") 
	{
		keycnt++
		if (keycnt>300) {
			ATOMkbd=""
			SHFT = 0xFF			
			CTRL = 0xFF	
			keycnt=0
		}
	}

	if (addr == 0) 
		// b000 OUTPUT 			
		return PORTA
		
	if (addr == 1) 
	{
		// b001 INPUT   KBY COL 0-5
		// CTRL 6, SHIFT 7	

		ROW = 0xFF
		
		if (ATOMkbd != "") 
		{	
			z=cvtkbd(ATOMkbd)
			a=z[0]
			b=z[1]
			
			if (KR==b) {
				ROW = ((~(0x01<<a))&0xff) 
			}			
		}	
		PORTB = (ROW & SHFT & CTRL) & 0xff		
		return 	PORTB
	}
	if (addr == 2) 
	{
		// b002 INPUT  7654 OUTPUT 3210  
		// 7 = 60Hz
		// 6 = REPT (actvie LOW)
		// 5 = Cas
		// 4 = 2.4 khz
		
		CASEBIT=0x00
		if (bitstream != "")
		{
			bit = bitstream.slice(0,1) // head of tape
						
			if (tCLK==0) {
				tCLK=CLK
			}
			
			var tt
			var nc = Math.round(((CLK-tCLK)/60))
			switch (bit) {
				case "0":  // low tone
					CASEBIT= ((nc % 4>1)  ? 0x20 : 0x00)
					tt=16
					break
				case "1":  // high tone
					// hold for 8 cnts
					CASEBIT= ((nc % 2 == 0)  ? 0x20 : 0x00)
					tt=16
					break
				case "X":
					// hold '1' for 1000 cnts
					CASEBIT= ((nc % 2 == 0)  ? 0x20 : 0x00)
					tt=4400
			}
			
			if (nc >= tt) 
			{
				bitstream=bitstream.slice(1)
				bit = bitstream.slice(0,1) // head of tape
				print_mon(bit)
				tCLK=CLK
			}			
		}		
		
		PORTC = 0
		PORTC |= aREPT 
		PORTC |= CASEBIT 
		PORTC |= (((CLK % 480) > 240) ? 0x80 : 0) // 60Hz
		PORTC |= (((CLK % 120) > 60)  ? 0x10 : 0) // 2400Hz

		debug_out("PORTC= ("+hex2(PORTC)+") "
			+ (((PORTC&0x80)==0x80)?"1 ":"0 ")  
			+ (((PORTC&0x40)==0x40)?"1 ":"0 ")  
			+ (((PORTC&0x20)==0x20)?"1 ":"0 ")  
			+ (((PORTC&0x10)==0x10)?"1 ":"0 ") )		
		return  PORTC
	}
}

function cvtfile2stream(file) 
{
		//tbd
		var ds="XXX"  // 
		
		for (i=0; i<file.length; i++)
		{
				ch = file[i]
				bb=("00000000" + ch.toString(2)).substr(-8)					
				bb = bb.split("").reverse().join("")
				
				s= "0" + bb + "1"    // start bit byte stop bit
				ds += s
		}	
		return ds
}

function cvtstream2file(tape)
{	
	var i, nb=0, cnt =0
	var s=""
	var F=[]
	// ignore first 4 == header
	
	for (i=4; i<tape.length; i++)
	{				
		if (tape[i][0]<200 && tape[i][1]=="1")	{					
			s += "1"
			cnt ++
		}					
		if (tape[i][0]==1 && tape[i][1]=="0") {	
			nb += 1
		}	

		if (nb == 8 ) {
			s += "0"
			nb=0
			cnt++
		}
			
		if (cnt == 10) {
			if (s.substr(0,1)=="0" && s.substr(-1)=="1") 
			{				
				bb=s.slice(1,-1)			
				bb = bb.split("").reverse().join("")				
				var v=parseInt(bb,2)
				F.push(v)
			} else {
				debug_out(s + ": ?? AT LOC "+i )
			}
			cnt=0
			s=""
		}
	}
	return F
}

const datastream=[]

function put_byte_8255(addr, v) 
{	
	addr = addr & 0x3	
	if (addr == 0) {
		// b000 OUTPUT  
		// KEY row 0-3
		// Graphics mode 4-7
		GM=((v&0b11110000)>>4)
		KR=(v&0b00001111)
		//debug_out("Set Graphic mode="+GM+" Set keybd row="+KR)
		PORTA = v		
		return v
	}	
	if (addr == 1) {
		// b001 OUTPUT   KBY COL 0-5
		return 0 // PORTB 
	}
	if (addr == 2) {
		// b002 OUTPUT 3210 
		// 0 TApe OUTPUT   			0x01
		// 1 enable cassette out	0x02
		// 2 loudspk				0x04
		// 3 n/a
		
		debug_out("PORTC="+hex2(v))
		
		var TapeOn = ((v&0x02)==0x02)
		var CasOn =  ((v&0x01)==0x01)
		var Spk =    ((v&0x04)==0x04) 
			
		if (TapeOn) 
		{
			if (datastream.length>0) {
				var A = datastream.pop()
				A[0] = Math.round((CLK-A[0])/120)
				datastream.push(A)	
			}
			datastream.push([CLK,"1"])   
		}
		else
		{
			if (datastream.length>0) {
				var A = datastream.pop()
				A[0] = Math.round((CLK-A[0])/120)
				datastream.push(A)	
			}				
			datastream.push([CLK, "0"]) 
		}
				 
		if (Spk) {
			beep()
		}		
		return 0 //PORTC
	}
	if (addr == 3) {
		debug_out("Write to 8522 control register)	")
		DDRB=v
		return
	} 	
}

/* ATOM VIA */
function put_byte_6522(addr,v)
{
	if (addr >= 0xb800 && addr< 0xc000) 
	{
		// writing to VIA I/O device
		debug_out("6522 VIA I/0 write address - "+hex4(addr))
	} 
}
	
function get_byte_6522()	
{
	if (addr >= 0xb800 && addr< 0xc000) 
	{
		// VIA I/O device
		debug_out("6522 VIA I/0 read address - "+hex4(addr))

	}
	return 0 /* not connected */
} 

//if you have another AudioContext class use that one, as some browsers have a limit
var audioCtx = new (window.AudioContext || window.webkitAudioContext || window.audioContext);

//duration of the tone in milliseconds. Default is 500
//frequency of the tone in hertz. default is 440
//volume of the tone. Default is 1, off is 0.
//type of tone. Possible values are sine, square, sawtooth, triangle, and custom. Default is sine.
//callback to use on end of tone
function beep(duration, frequency, volume, type, callback) {
    var oscillator = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (volume){gainNode.gain.value = volume;}
    if (frequency){oscillator.frequency.value = frequency;}
    if (type){oscillator.type = type;}
    if (callback){oscillator.onended = callback;}
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + ((duration || 500) / 1000));
};