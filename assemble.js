
const ILIST = 
[["ADC",0x69,0x65,0x75,0x6d,0x7d,0x79,0x61,0x71,"IZxAXYiy"],
["AND",0x29,0x25,0x35,0x2d,0x3d,0x39,0x21,0x31,"IZxAXYiy"],
["ASL",0x0a,0x06,0x16,0x0e,0x1e,"aZxAX"],
["BCC",0x90,"r"],
["BCS",0xb0,"r"],
["BEQ",0xf0,"r"],
["BIT",0x24,0x2c,"ZA"],
["BMI",0x30,"r"],
["BNE",0xd0,"r"],
["BPL",0x10,"r"],
["BRK",0x00],
["BVC",0x50,"r"],
["BVS",0x70,"r"],
["CLC",0x18],
["CLD",0xd8],
["CLI",0x58],
["CLV",0xb8],
["CMP",0xc9,0xc5,0xd5,0xcd,0xdd,0xd9,0xc1,0xd1,"IZxAXYiy"],
["CPX",0xe0,0xe4,0xec,"IZA"],
["CPY",0xc0,0xc4,0xcc,"IZA"],
["DEC",0xc6,0xd6,0xce,0xde,"ZxAX"],
["DEX",0xca],
["DEY",0x88],
["EOR",0x49,0x45,0x55,0x4d,0x5d,0x59,0x41,0x51,"IZxAXYiy"],
["INC",0xe6,0xf6,0xee,0xfe,"ZxAX"],
["INX",0xe8],
["INY",0xc8],
["JMP",0x4c,0x6c,"Aj"],
["JSR",0x20,"A"],
["LDA",0xa9,0xa5,0xb5,0xad,0xbd,0xb9,0xa1,0xb1,"IZxAXYiy"],
["LDX",0xa2,0xa6,0xb6,0xae,0xbe,"IZzAY"],
["LDY",0xa0,0xa4,0xb4,0xac,0xbc,"IZxAX"],
["LSR",0x4a,0x46,0x56,0x4e,0x5e,"aZxAX"],
["NOP",0xea],
["ORA",0x09,0x05,0x15,0x0d,0x1d,0x19,0x01,0x11,"IZxAXYiy"], 
["PHA",0x48],
["PHP",0x08],
["PLA",0x68],
["PLP",0x28],
["ROL",0x2a,0x26,0x36,0x2e,0x3e,"aZxAX"],
["ROR",0x6a,0x66,0x76,0x6e,0x7e,"aZxAX"],  
["RTI",0x40],
["RTS",0x60],
["SBC",0xe9,0xe5,0xf5,0xed,0xfd,0xf9,0xe1,0xf1,"IZxAXYiy"],
["SEC",0x38],
["SED",0xf8],
["SEI",0x78],
["STA",0x85,0x95,0x8d,0x9d,0x99,0x81,0x91,"ZxAXYiy"],
["STX",0x86,0x96,0x8e,"ZzA"],
["STY",0x84,0x94,0x8c,"ZxA"],
["TAX",0xaa],
["TAY",0xa8],
["TSX",0xba],
["TXA",0x8a],
["TXS",0x9a],
["TYA",0x98]]

var labels  = {}  //dictionary

var ORG=0x0000

function checkins(x) {
	var i
	x=x.toUpperCase()
	
	for (i=0; i<ILIST.length; i++)
	{
			if (x == ILIST[i][0]) {
				return i
			}
	}
	return -1
}

function checkopc(x) {
	for (i=0; i<ILIST.length; i++)
	{
		for (j=1; j<ILIST[i].length; j++) {
			if (ILIST[i][j]==x) {
				if (typeof ILIST[i][ILIST[i].length-1] === "object") {
					nb = ILIST[i][ILIST[i].length-1][j-1]
					return [ILIST[i][0],nb]	
				}					
				else
				if (typeof ILIST[i][ILIST[i].length-1] === "string") {
					nb = ILIST[i][ILIST[i].length-1][j-1]
					return [ILIST[i][0],nb]	
				}					
				else
				return [ILIST[i][0],1]	
			}				
		}
	}
	return ["UDF",0]
}

function hex2(dec) {
	return ("00" + dec.toString(16)).substr(-2)
}

function hex4(dec) {
				
	return ("0000" + dec.toString(16)).substr(-4)
}

function hex4e(dec) {	
	for (var key in labels)
		if (labels[key] == dec)
			return key
			
	return hex4(dec)
}

function isLabel(str) {
	var i
	if (str != "" && str.length>0)
	{
		var ch= str.substr(0,1)
		if ((ch>='a' && ch <='f') || (ch >='A' && ch <= 'F')) {
			for (i=1; i<str.length; i++)
			{
				var ch = str.substr(i,1)
				if ((ch>='0' && ch<= '9') || (ch>='a' && ch <='f') || (ch >='A' && ch <= 'F'))
					;
				else
					return false
			}
			return true
		}
	}
	return false
}
	
function isNumeric(str) {
	if (str=="") return false
	if (str in labels)
			return true
			
	if (str.substr(0,1)=="$")
	{
		for (i=1; i<str.length; i++)
		{
			var ch = str.substr(i,1)
			if ((ch>='0' && ch<= '9') || (ch>='a' && ch <='f') || (ch >='A' && ch <= 'F'))
				;
			else
				return false
		}
		return true
	}
	return !isNaN(str)
}

function str2num(str) {
	if (str in labels)
		return labels[str]
	
	if (isLabel(str)) {
		return 0 // not defined (yet)
	}
			
	if (str.substr(0,1)=="$")
	{
		n=0
		for (i=1; i<str.length; i++)    
		{
			ch = str.substr(i,1)
			cc=ch.charCodeAt(0)
			if (ch>='0' && ch<= '9')
				n=n*16+(cc - 48);
			else if (ch>='a' && ch <='f')
				n=n*16+(cc-97)+10;
			else if (ch >='A' && ch <= 'F')
				n=n*16+(cc-65)+10;
			else
				return 0
		}
		return n
	}
	return (Number(str))
}	

function assemble(mloc, str, pass=2) {
	var i,txt, z
	
	if (str.indexOf(";")>=0) {
		txt = str.split(";")
		str=txt[0]
	}
	if (str=="")
		return mloc
	txt = str.split(" ")
	for (i=0; i<txt.length; i++) {
		if (txt[i]== "" || txt[i]=="\t")
			continue
		
		if (txt[i].substr(-1)==":") {
			/* label: */
			// store NVP   label=mloc
			labels[txt[i].slice(0,-1)]=mloc
			i+=1
			if (i==txt.length)
				return mloc
		}
		
		if (txt[i].toUpperCase()==".WORD") {
			/* label: */
			w = str2num(txt[i+1])
			i+=1
			put_byte(mloc,w &0xFF)
			put_byte(mloc+1,(w &0xFF00)>>8)
			mloc += 2
			return mloc
		}
		
		if (txt[i].toUpperCase()==".ORG") {
			ORG = str2num(txt[i+1])
			return ORG
		}
		var op,mb			
		z = checkins(txt[i])
		if (z >=0 ) {	
			// legal instruction ILIST[z]
			if (ILIST[z].length==2) {
				put_byte(mloc,ILIST[z][1])
				mloc += 1
			}
			else {
				// get valid addressing modes
				mods=ILIST[z][ILIST[z].length-1]
				s=txt[i+1] 
				b=isNumeric(s)
				bc=0
				debug_out(ILIST[z][0] +"=" + mods + "(" + s +")")
				for (c=0; c<mods.length; c++)
				{
					switch (mods[c]) {
					case 'I' :
						// should be #nn
						if (s[0]=="#" ) {
							mb=str2num(s.substr(1))
							bc=2
						}
						break							
					case 'Z':
						// should be nn
						if (b ) {
							mb=str2num(s)
							if (mb>255)
								break;
							bc=2
						}
						break
					case 'a':
						// should be A
						if (s=='A') {
							bc=1
						}
						break	
					case 'A': // should be nnnn
						if (b ) {
							mb=str2num(s)
							bc=3
						}						
						break
					case 'x':   // nn,X
						if (s.substr(-2)==",X"){
							mb=str2num(s.slice(0,-2))
							if (mb>255)
								break;
							bc=2
						}
						break							
					case 'X':   // nnnn,X
						if (s.substr(-2)==",X") {
							mb=str2num(s.slice(0,-2))
							bc=3
						}
						break
					case 'y':	// (nn),y
						if (s[0]=="(" && s.substr(-3)=="),Y") {
							s=s.slice(1,-3)
							mb=str2num(s)
							bc=2
						}
						break
					case 'Y':	// nnnn,Y
						if (s[0] != "(" && s.substr(-2)==",Y") {
							mb=str2num(s.slice(0,-2))
							bc=3
						}
						break
					case 'i':	// (nn,X)
						if (s[0]=="(" && s.substr(-3)==",X)") {
							s=s.slice(1,-3)
							mb=str2num(s)
							bc=2
						}
						break

					case 'j':	// (nnnn)
						if (s[0]=="(" && s.substr(-1)==")") {
							s=s.slice(1,-1)
							mb=str2num(s)
							bc=3
						}
						break
					case 'r':	// nnnn (relative address)
						if (b ) {
							mb=str2num(s)
							mb=(mb -(mloc+2)&0xFF)
							bc=2
						}	
						break
					default:
						break
					}
					if (bc>0) {
						op =ILIST[z][c+1]
						put_byte(mloc,op)
						mloc += 1
						if (bc>1) {
							put_byte(mloc,mb&0xff)
							mloc += 1
							if (bc > 2) {
								put_byte(mloc,(mb&0xff00)>>8)
								mloc += 1
							}
						}
						return mloc
					}								
				}
				debug_out("no addr mode match ??")
				return -1
			}
		}			
		else
			mloc = -1
		
		i=txt.length
	}
	return mloc
}
// IZxzAXYiyjr	
function disassemble(mloc) {
	var ins, cnt=0, str=""
	ins = get_byte(mloc)
	op  = checkopc(ins)		
	
	switch (op[1])
	{
		case 1:
			str = op[0]
			cnt=1
			break
		case 2:
			str = op[0] + " " + hex2(get_byte(mloc+1))
			cnt=2
			break
		case 3:
			str = op[0] + " " + hex4(get_word(mloc+1))
			cnt=3
			break
		case 'a' :
			str = op[0] + " A"		
			cnt=1
			break
		case 'I' :
			str = op[0] + " #" + hex2(get_byte(mloc+1))		
			cnt=2
			break
		case 'Z' :
			str = op[0] + " $" + hex2(get_byte(mloc+1))	
			cnt=2
			break
		case 'x' :
			str = op[0] + " $" + hex2(get_byte(mloc+1)) 	+ ",X"	
			cnt=2
			break				
		case 'z' :
			str = op[0] + " $" + hex2(get_byte(mloc+1)) 	+ ",Y"	
			cnt=2
			break
		case 'A' :
			str = op[0] + " $" + hex4(get_word(mloc+1))	
			cnt=3
			break	
		case 'X' :
			str = op[0] + " $" + hex4(get_word(mloc+1))		+ ",X"
			cnt=3
			break
		case 'Y' :
			str = op[0] + " $" + hex4(get_word(mloc+1))		+ ",Y"
			cnt=3
		case 'i' :
			str = op[0] + " ($" + hex2(get_byte(mloc+1))	+ ",X)"	
			cnt=2
			break
		case 'y' :
			str = op[0] + " ($" + hex2(get_byte(mloc+1))	+ "),Y"	
			cnt=2
			break
		case 'j' :
			str = op[0] + " ($" + hex4(get_word(mloc+1))	+ ")"	
			cnt=3
			break
		case 'r' :
			o=get_byte(mloc+1)
			if (o>127) o = o - 256
			o = ((mloc + 2 + o) & 0xffff)
			str = op[0] + " $" + hex4(o)
			cnt=2
			break
	}		

	return [str,cnt]
}

function loadassemble(str, n) {
	ORG=n
	var st=str.split("\n")
	
	q=n
	print_mon("1st pass\n")
	for (var j=0; j<st.length; j++) 
	{
		// 1st pass
		var q = assemble(q, st[j])
	}	
	
	print_mon("2nd pass\n")
	for (var j=0; j<st.length; j++) 
	{
		// 2nd pass
		var q = assemble(n, st[j])
		if (q < 0) {
			print_mon("ASSMB ERROR line " + j +"\n")
			return			
		} else { 
			b=""
			for (i=0;i<q-n;i++)
				b += hex2(get_byte(n+i)) + " "
			
			b  =  (b + "        ").substr(0,9)
			
				
			print_mon(hex4(n) + " " + b + st[j] + "\n")
			n=q
		}
	}
	for (var key in labels)
		print_mon(key +"... "+ labels[key]+"\n")
	
	return ORG // start address
}