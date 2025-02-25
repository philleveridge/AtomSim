/*  MAIN 6502 Simulator */

/* 6502 registers */

Acc	=0
Xreg=0
Yreg=0
SP	=0
PC	=0

fC=false
fZ=false
fD=false
fV=false
fN=false
fB=false
fI=false

/* NV-BDIZC */	
const NFLG = 0x80
const VFLG = 0x40
const BFLG = 0x10
const DFLG = 0x08
const IFLG = 0x04
const ZFLG = 0x02
const CFLG = 0x01

CLK=0

XDBG=false

var nmi_int=0
	
function get_sr() {
	S = (	((fC==true) ? CFLG : 0) | 
			((fZ==true) ? ZFLG : 0) |
			((fD==true) ? DFLG : 0) |
			((fV==true) ? VFLG : 0) |
			((fI==true) ? IFLG : 0) |
			((fN==true) ? NFLG : 0) |
			0x30)
	return S
}

BPnt= -1 /* Not set */
IPnt= -1 /* Not set */
IVadd = 0
	
function reset() {
	/*
	Load PC from memory location FFFC
	*/
	PC = get_word(0xFFFC)
}	

function nmi_interupt() {
	push_byte(PC >> 8)
	push_byte(PC & 0xFF)
	push_byte(get_sr())	
	fI=false 
	PC = get_word(0xFFFA)
	//XDBG=1
}

function push_byte(v) {
	saddr = 0x0100 + SP
	SP = (SP - 1) & 0xff
	//debug_out("push("+v+")->"+ saddr)
	put_byte(saddr, v)
}

function pop_byte() {
	SP = (SP + 1) & 0xff
	saddr = 0x0100 + SP

	return get_byte(saddr)
}
	
function compare(a,b) 
{
	update_zn(a-b)
	fC = (a>=b)
}	

function update_zn(x)
{
	x = x & 0xff
	fZ = (x==0)	
	fN = ((x & 0x80) == 0x80) 	
	return x
}

//https://www.righto.com/2012/12/the-6502-overflow-flag-explained.html

function Adc(N)
{
	if (!fD) {
		var result = Acc + N  + ((fC) ? 1: 0)
		fV = (!((Acc ^ N) & 0x80) && 
			  (((Acc ^ result) & 0x80)==0x80))
		Acc= result & 0xFF
		fC = ((result & 0x100)==0x100)
		update_zn(Acc) 	  /* Z & N */
	} else {
		debug_out("Decimal mode test")

		ah = 0
		fZ = false
		fN = false
		tempb = Acc + N + (fC ? 1 : 0)
		fZ= (!tempb)		
		al = (Acc & 0xF) + (N & 0xF) + (fC ? 1 : 0)
		if (al > 9)	
		{
			al -= 10;
			al &= 0xF;
			ah = 1;
		}
		ah += ((Acc >> 4) + (N >> 4))
		if (ah & 8) fN = true
		fV = (((ah << 4) ^ Acc) & 128) && !((Acc ^ N) & 128)
		fC = false
		if (ah > 9)
		{
			fC = true
			ah -= 10
			ah &= 0xF
		}
		Acc = (al & 0xF) | (ah << 4)		
	}		
}	

function Sbc(N) 
{ 
	if (!fD) {
	N= 255-N // 2C
	Adc(N)
	}
	else
	{
		debug_out("Decimal mode test")
		hc = 0
		fZ = false
		fN = false
                tempb = Acc - N - ((fC) ? 0 : 1)
		if (!(tempb))
			fZ = 1;	
		al = (Acc & 15) - (N & 15) - ((fC) ? 0 : 1)
		if (al & 16)
		{
			al -= 6;
			al &= 0xF;
			hc = 1;
		}
		ah = (Acc >> 4) - (N >> 4);
		if (hc) ah--;	
		if ((Acc - (N + ((fC) ? 0 : 1))) & 0x80)
			fN = true
		fV = ((Acc ^ N) & 0x80) && ((Acc ^ tempb) & 0x80);
		fC = true
		if (ah & 16)
		{
			fC = 0;
			ah -= 6;
			ah &= 0xF;
		}
		Acc = (al & 0xF) | ((ah & 0xF) << 4)
	}
}

function branch(ofs, bool) {
		if (ofs>127)
			ofs = ofs - 256
		if (bool) {
			/* branch */
			if (ofs == -2)
			{
				print_mon( "Loop detected at " + hex4(PC) + "\n")
			}
			PC = (PC + ofs) & 0xffff
		}
}

/* LOAD instruction from PC */
function execute() 
{
	if (nmi_int==1) {
		nmi_int=0
		nmi_interupt()
	}
	
	ins = mem[PC]	
	
	CLK++	
	
	if (BPnt == PC && ss==0) {
		print_mon( "Break at " + hex4(PC) +"\n")
		halt=true
		return ""
	}

	if (XDBG || IPnt == PC) { /* for debug */
		var s=disassemble(PC)
		var str  = " (A="  + hex2(Acc) + " "
		str += "X="  + hex2(Xreg) + " "
		str += "Y="  + hex2(Yreg) + " "
		str += "SP=" + hex2(SP) + "  "
		str +=  PSR2text() + ")"
		if (s[0]=="")
			str = hex4(PC) + " " + hex2(get_byte(PC))+ ": Error "
		else 
			str = hex4(PC) + " " + hex2(get_byte(PC))+ ": " + s[0] +str
		
		stk="{1F0:"+hex2(mem[0x1F0])+" "+hex2(mem[0x1F1])+" "+hex2(mem[0x1F2])+" "+hex2(mem[0x1F3])+" "
		stk +=      hex2(mem[0x1F4])+" "+hex2(mem[0x1F5])+" "+hex2(mem[0x1F6])+" "+hex2(mem[0x1F7])+"  "
		stk +=      hex2(mem[0x1F8])+" "+hex2(mem[0x1F9])+" "+hex2(mem[0x1Fa])+" "+hex2(mem[0x1Fb])+" "
		stk +=      hex2(mem[0x1Fc])+" "+hex2(mem[0x1Fd])+" "+hex2(mem[0x1Fe])+" "+hex2(mem[0x1Ff])+"}"
			
		if (IPnt == PC) {			
			str = str + "   " + hex4(IVadd) + ": " + hex2(mem[IVadd]) + " " + hex2(mem[IVadd+1]) 
			print_mon( str +"\n"+ stk + "\n")
		}
		//debug_out(str + "\n" + stk)
		debug_out(str )			
	}
	
	PC += 1		
	
	switch (ins) {
	
	case 0x69: /* ADC # */
		M = get_byte(PC)						
		Adc(M) //Acc =  update_flgs_adc(Acc, M)
		PC += 1        
		break
	case 0x65: /* ADC  nn*/
		M = get_byte(get_byte(PC))						
		Adc(M) //
		PC += 1		
		break
	case 0x75: /* ADC  nn,X*/
		M = get_byte((get_byte(PC)+Xreg)&0xff)						
		Adc(M) //Acc =  update_flgs_adc(Acc, M)
		PC += 1		
		break
	case 0x6d: /* ADC  nnnn*/
		M = get_byte(get_word(PC))						
		Adc(M) //Acc =  update_flgs_adc(Acc, M)
		PC += 2		
		break
	case 0x7d: /* ADC  nnnn,x*/
		M = get_byte(get_word(PC)+Xreg)						
		Adc(M) //Acc =  update_flgs_adc(Acc, M)
		PC += 2		
		break	
	case 0x79: /* ADC  nnnn,y*/
		M = get_byte(get_word(PC)+Yreg)						
		Adc(M) //Acc =  update_flgs_adc(Acc, M)
		PC += 2		
		break
	case 0x61: /* ADC  (nn,x)*/
		addr=(get_byte(PC)+Xreg)&0xff
		M = get_byte(get_word(addr))						
		Adc(M) //Acc =  update_flgs_adc(Acc, M)
		PC += 1		
		break
	case 0x71: /* ADC  (nn),y*/
		addr=get_byte(PC)
		M = get_byte(get_word(addr)+Yreg)						
		Adc(M) //Acc =  update_flgs_adc(Acc, M)
		PC += 1		
		break		
	case 0x29: /* AND # */
		M = get_byte(PC)						
		Acc =  Acc & M
		update_zn(Acc)
		PC += 1
		break			
	case 0x25: /* AND nn */
		addr = get_byte(PC)	
		M=get_byte(addr)
		Acc =  Acc & M
		update_zn(Acc)
		PC += 1
		break	
	case 0x35: /* AND nn,X */
		addr = (get_byte(PC)+Xreg)&0xff	
		M=get_byte(addr)
		Acc =  Acc & M
		update_zn(Acc)
		PC += 1
		break
	case 0x2d: /* AND nnnn */
		addr = get_word(PC)	
		M=get_byte(addr)
		Acc =  Acc & M
		update_zn(Acc)
		PC += 2
		break
	case 0x3d: /* AND nnnn,X */
		addr = get_word(PC)	+ Xreg
		M=get_byte(addr)
		Acc =  Acc & M
		update_zn(Acc)
		PC += 2
		break
	case 0x39: /* AND nnnn,Y */
		addr = get_word(PC)	+ Yreg
		M=get_byte(addr)
		Acc =  Acc & M
		update_zn(Acc)
		PC += 2
		break
	case 0x21: /* AND (nn,X) */
		addr = (get_byte(PC)+Xreg)&0xff	
		M=get_byte(get_word(addr))
		Acc =  Acc & M
		update_zn(Acc)
		PC += 1
		break
	case 0x31: /* AND (nn),Y */
		addr = get_byte(PC)
		M=get_byte(get_word(addr)+Yreg)
		Acc =  Acc & M
		update_zn(Acc)
		PC += 1
		break
		
	case 0x0a: /* ASL A */
		M=Acc
		fC=  ((M & 0x80) == 0x80)
		Acc = (M<<1)&0xFE
		update_zn(Acc)
		break		
	case 0x06: /* ASL nn */
		addr=get_byte(PC)
		M=get_byte(addr)
		PC += 1
		fC = ((M & 0x80) == 0x80)
		M = (M<<1)&0xFE
		put_byte(addr, M)
		update_zn(M)
		break
	case 0x16: /* ASL nn,X */
		addr=(get_byte(PC)+Xreg)&0xff
		M=get_byte(addr)
		PC += 1
		fC = ((M & 0x80) == 0x80)
		M = (M<<1)&0xFE
		put_byte(addr, M)
		update_zn(M)
		break
	case 0x0e: /* ASL nnnn */
		addr=get_word(PC)
		M=get_byte(addr)
		PC += 2
		fC = ((M & 0x80) == 0x80)
		M = (M<<1)&0xFE
		put_byte(addr, M)
		update_zn(M)
		break
	case 0x1e: /* ASL nnnn,X */
		addr=get_word(PC)+Xreg
		M=get_byte(addr)
		PC += 2
		fC = ((M & 0x80) == 0x80)
		M = (M<<1)&0xFE
		put_byte(addr, M)
		update_zn(M)
		break
		
	case 0x90: /* BCC */
		ofs = get_byte(PC)
		PC += 1
		branch(ofs, !fC)
		break 
	case 0xB0: /* BCS */
		ofs = get_byte(PC)
		PC += 1
		branch(ofs, fC)
		break 			
	case 0xf0: /* BEQ */
		ofs = get_byte(PC)
		PC += 1
		branch(ofs, fZ)		
		break 						
	case 0x24: /* BIT nn */
		M = get_byte(get_byte(PC))	
		fZ = !(Acc & M)
		fV = ((M & 0x40) == 0x40)
		fN = ((M & 0x80) == 0x80)	
		PC += 1
		break		
	case 0x2c: /* BIT nnnn */
		M = get_byte(get_word(PC))
		fZ = !(Acc & M)
		fV = ((M & 0x40) == 0x40)
		fN = ((M & 0x80) == 0x80)		
		PC += 2
		break				
	case 0x30: /* BMI */
		ofs = get_byte(PC)
		PC += 1
		branch(ofs, fN)
		break
	case 0xd0: /* BNE */
		ofs = get_byte(PC)
		PC += 1
		branch(ofs, !fZ)
		break 
	case 0x10: /* BPL */
		ofs = get_byte(PC)
		PC += 1
		branch(ofs, !fN)
		break 
		
	case 0: /* BRK */
		push_byte(PC+1 >> 8)
		push_byte(PC+1 & 0xFF)
		push_byte(get_sr())	
		fI=true 
		PC = get_word(0xFFFE)			
		break //return "? BRK\n" 		
	case 0x50: /* BVC */
		ofs = get_byte(PC)
		PC += 1
		branch(ofs, !fV)
		break 
	case 0x70: /* BVS */
		ofs = get_byte(PC)
		PC += 1
		branch(ofs, fV)
		break 	
		
	case 0x18: /* CLC */
		fC=false
		break
	case 0xd8: /* CLD */
		fD=false
		break	
	case 0x58: /* CLI */
		fI=false
		break
	case 0xb8: /* CLV */
		fV=false
		break
		
	case 0xc9: /* cmp # */
		compare(Acc,get_byte(PC))
		PC += 1
		break
	case 0xc5: /* cmp  nn*/
		compare(Acc,get_byte(get_byte(PC)))
		PC += 1
		break
	case 0xd5: /* cmp  nn,x*/
		compare(Acc,get_byte((get_byte(PC)+Xreg)&0xff))
		PC += 1
		break
	case 0xcd: /* cmp  nnnn*/
		compare(Acc,get_byte(get_word(PC)))
		PC += 2
		break
	case 0xdd: /* cmp  nnnn,x*/
		compare(Acc,get_byte(get_word(PC)+Xreg))
		PC += 2
		break
	case 0xd9: /* cmp  nnnn,y*/
		compare(Acc,get_byte(get_word(PC)+Yreg))
		PC += 2
		break
	case 0xc1: /* cmp  (nn,x)*/
		addr=(get_byte(PC)+Xreg)&0xff 
		compare(Acc,get_byte(get_word(addr)))
		PC += 1
		break
	case 0xd1: /* cmp  (nn),y*/
		compare(Acc,get_byte(get_word(get_byte(PC))+Yreg))
		PC += 1
		break
		
	case 0xe0: /* CPX # */
		compare(Xreg,get_byte(PC))
		PC += 1
		break			
	case 0xec: /* CPX nnnn */
		compare(Xreg,get_byte(get_word(PC)))
		PC += 2
		break	
	case 0xe4: /* CPX nn */
		compare(Xreg,get_byte(get_byte(PC)))
		PC += 1
		break	

	case 0xc0: /* CPY # */
		compare(Yreg,get_byte(PC))
		PC += 1
		break			
	case 0xcc: /* CPY nnnn */
		compare(Yreg,get_byte(get_word(PC)))
		PC += 2
		break	
	case 0xc4: /* CPY nn */
		compare(Yreg,get_byte(get_byte(PC)))
		PC += 1
		break	
					
	case 0xC6: /* DEC  nn */
		addr=get_byte(PC)
		M=get_byte(addr)-1
		put_byte(addr,update_zn(M))
		PC += 1
		break;
	case 0xD6: /* DEC  nn,X */
		addr=(get_byte(PC)+Xreg)&0xff
		M=get_byte(addr)-1
		put_byte(addr,update_zn(M))
		PC += 1
		break;
	case 0xde: /* DEC  nnnn,X */
		addr=get_word(PC)+Xreg
		M=get_byte(addr)-1
		put_byte(addr,update_zn(M))
		PC += 2
		break;			
	case 0xce: /* DEC  nnnn */
		addr=get_word(PC)
		M=get_byte(addr)-1
		put_byte(addr,update_zn(M))
		PC += 2
		break;
	case 0xCA: /* DEX */
		Xreg = update_zn(Xreg-1)
		break;			
	case 0x88: /* DEY */                
		Yreg = update_zn(Yreg-1)
		break
		
	case 0x49: /* EOR # */
		M = get_byte(PC)						
		Acc =  Acc ^ M
		update_zn(Acc)
		PC += 1
		break
	case 0x45: /* EOR nn */
		M = get_byte(get_byte(PC))						
		Acc =  Acc ^ M
		update_zn(Acc)
		PC += 1
		break			
	case 0x55: /* EOR nn,X */
		M = get_byte((get_byte(PC)+Xreg)&0xFF)					
		Acc =  Acc ^ M
		update_zn(Acc)
		PC += 1
		break
	case 0x4d: /* EOR nnnn */
		M = get_byte(get_word(PC))						
		Acc =  Acc ^ M
		update_zn(Acc)
		PC += 2
		break	
	case 0x5d: /* EOR nnnn,X */
		M = get_byte(get_word(PC)+Xreg)						
		Acc =  Acc ^ M
		update_zn(Acc)
		PC += 2
		break				
	case 0x59: /* EOR nnnn,Y */
		M = get_byte(get_word(PC)+Yreg)						
		Acc =  Acc ^ M
		update_zn(Acc)
		PC += 2
		break
	case 0x41: /* EOR (nn,X) */
		addr = (get_byte(PC)+Xreg)&0xff
		M = get_byte(get_word(addr))				
		Acc =  Acc ^ M
		update_zn(Acc)
		PC += 1
		break
	case 0x51: /* EOR (nn),Y */
		addr = get_byte(PC)
		M = get_byte(get_word(addr)+Yreg)					
		Acc =  Acc ^ M
		update_zn(Acc)
		PC += 1
		break
		
	case 0xE6: /* INC <nn> */
		addr=get_byte(PC)
		M=get_byte(addr)+1
		put_byte(addr,M)
		update_zn(M)
		PC += 1
		break;
	case 0xEe: /* INC <nnnn> */
		addr=get_word(PC)
		M=get_byte(addr)+1
		put_byte(addr,M)
		update_zn(M)
		PC += 2
		break;
	case 0xf6: /* INC <nn>,X */
		addr=(get_byte(PC)+Xreg)&0xff
		M=get_byte(addr)+1
		put_byte(addr,M)
		update_zn(M)
		PC += 1
		break;
	case 0xfe: /* INC <nnnn>,X */
		addr=get_word(PC)+Xreg
		M=get_byte(addr)+1
		put_byte(addr,M)
		update_zn(M)
		PC += 2
		break;							
	case 0xE8: /* INX */
		Xreg = update_zn(Xreg+1)
		update_zn(Xreg)
		break;			
	case 0xC8: /* INY */
		Yreg = update_zn(Yreg+1)
		update_zn(Yreg)
		break;
		
	case 0x4c: /* JMP <nnnn>*/
		addr = get_word(PC)
		PC = addr
		break;
	case 0x6c: /* JMP (<nnnn>)*/
		addr = get_word(PC)
		PC = get_word(addr)
		break;
	case 0x20: /* JSR nnnn*/
		addr = get_word(PC)
		push_byte(PC+1 >> 8)
		push_byte(PC+1 & 0xFF)
		PC = addr
		break 
		
	case 0xA9: /* LDA #$ */
		Acc = get_byte(PC)
		PC += 1
		update_zn(Acc)
		break;
	case 0xA5: /* LDA nn */
		Acc = get_byte(get_byte(PC))
		PC += 1
		update_zn(Acc)
		break;
	case 0xAD: /* LDA <nnnn>*/
		addr = get_word(PC)
		Acc = get_byte(addr)
		PC += 2
		update_zn(Acc)
		break;			
	case 0xb5: /* LDA nn,x*/
		addr = (get_byte(PC)+ Xreg)&0xff
		Acc = get_byte(addr)
		PC += 1	
		update_zn(Acc)			
		break;			
	case 0xbd: /* LDA <nnnn>,x*/
		addr = get_word(PC)	+ Xreg
		Acc = get_byte(addr)
		PC += 2
		update_zn(Acc)			
		break;	
	case 0xb9: /* LDA <nnnn>,y*/		
		addr = get_word(PC)	+ Yreg
		Acc = get_byte(addr)
		PC += 2
		update_zn(Acc)			
		break;	
	case 0xA1: /* LDA (<nn>,x)*/
		addr = (get_byte(PC)+ Xreg) &0xff	
		Acc = get_byte(get_word(addr))
		update_zn(Acc)
		PC += 1
		break;		
	case 0xb1: /* LDA (<nn>),y*/	
		addr = get_byte(PC)
		Acc = get_byte(get_word(addr)+Yreg)
		update_zn(Acc)
		PC += 1			
		break;
		
	case 0xa2: /* LDX # */
		Xreg = get_byte(PC)
		update_zn(Xreg)
		PC += 1
		break;			
	case 0xa6: /* LDX $nn */
		Xreg = get_byte(get_byte(PC))
		update_zn(Xreg)
		PC += 1
		break;
	case 0xae: /* LDX $nnnn */
		Xreg = get_byte(get_word(PC))
		update_zn(Xreg)
		PC += 2
		break;
	case 0xb6: /* LDX $nn,Y */
		Xreg = get_byte((get_byte(PC)+Yreg)&0xff)
		update_zn(Xreg)
		PC += 1
		break;
	case 0xbe: /* LDX $nnnn,Y */
		Xreg = get_byte(get_word(PC)+Yreg)
		update_zn(Xreg)
		PC += 2
		break;	

	case 0xA0: /* LDY #*/
		Yreg = get_byte(PC) 
		update_zn(Yreg)
		PC += 1
		break;
	case 0xA4: /* LDY nn*/
		Yreg = get_byte(get_byte(PC) )
		update_zn(Yreg)
		PC += 1
		break;
	case 0xB4: /* LDY nn,X*/
		Yreg = get_byte((get_byte(PC)+Xreg )&0xff)
		update_zn(Yreg)
		PC += 1
		break;
	case 0xAc: /* LDY nnnn*/
		Yreg = get_byte(get_word(PC) )
		update_zn(Yreg)
		PC += 2
		break;
	case 0xbc: /* LDY nnnn,X*/
		Yreg = get_byte(get_word(PC)+Xreg  )
		update_zn(Yreg)
		PC += 2
		break;
		
	/* todo LSR 4a,4c,56,4e,5e */	
	
	case 0x4a: /* LSR A  */
		fC = ((Acc & 0x01) == 0x01)	
		fN = false	
		Acc = (Acc>>1) & 0x7f	
		update_zn(Acc)			
		break
	case 0x46: /* LSR $nn  */
		addr=get_byte(PC)
		M=get_byte(addr)
		PC +=1
		fC = ((M & 0x01) == 0x01)	
		fN = false	
		M = (M>>1) & 0x7f	
		update_zn(M)
		put_byte(addr,M)
		break
	case 0x56: /* LSR $nn,X  */
		addr=(get_byte(PC)+Xreg) &0xff
		M=get_byte(addr)
		PC +=1
		fC = ((M & 0x01) == 0x01)	
		fN = false	
		M = (M>>1) & 0x7f	
		update_zn(M)
		put_byte(addr,M)
		break
	case 0x4e: /* LSR $nnnn  */
		addr=get_word(PC)
		M=get_byte(addr)
		PC +=2
		fC = ((M & 0x01) == 0x01)	
		fN = false	
		M = (M>>1) & 0x7f	
		update_zn(M)
		put_byte(addr,M)			
		break
	case 0x5e: /* LSR $nnnn,X  */
		addr=get_word(PC)+Xreg
		M=get_byte(addr)
		PC +=2
		fC = ((M & 0x01) == 0x01)	
		fN = false	
		M = (M>>1) & 0x7f	
		update_zn(M)
		put_byte(addr,M)			
		break
		
	case 0xea: /* NOP */
		break 	
		
	case 0x09: /* ORA # */
		M = get_byte(PC)						
		Acc =  Acc | M
		update_zn(Acc)
		PC += 1
		break
	case 0x05: /* ORA nn */
		M = get_byte(get_byte(PC))						
		Acc =  Acc | M
		update_zn(Acc)
		PC += 1
		break	
	case 0x15: /* ORA nn,X */
		M = get_byte((get_byte(PC)+Xreg)& 0xff)						
		Acc =  Acc | M
		update_zn(Acc)
		PC += 1
		break				
	case 0x0d: /* ORA nnnn */
		M = get_byte(get_word(PC))						
		Acc =  Acc | M
		update_zn(Acc)
		PC += 2
		break
	case 0x1d: /* ORA nnnn,X */
		M = get_byte(get_word(PC)+Xreg)						
		Acc =  Acc | M
		update_zn(Acc)
		PC += 2
		break
	case 0x19: /* ORA nnnn,Y */
		M = get_byte(get_word(PC)+Yreg)						
		Acc =  Acc | M
		update_zn(Acc)
		PC += 2
		break
	case 0x01: /* ORA (nn,X) */
		addr=get_word((get_byte(PC)+Xreg)&0xff)
		M = get_byte(addr)
		Acc =  Acc | M
		update_zn(Acc)
		PC += 1
		break
	case 0x11: /* ORA (nn),Y*/
		addr=get_word(get_byte(PC))
		M = get_byte(addr+Yreg)						
		Acc =  Acc | M
		update_zn(Acc)
		PC += 1
		break
		
	case 0x48: /* PHA */	
		push_byte(Acc)
		break;
	case 0x08: /* PHP */	
		push_byte(get_sr())
		break;
	case 0x68: /* PLA */	
		Acc = pop_byte()
		update_zn(Acc)
		break;
	case 0x28: /* PLP */
		temp = pop_byte() 
		fC = (temp & CFLG) == CFLG
		fZ = (temp & ZFLG) == ZFLG
		fI = (temp & IFLG) == IFLG
		fD = (temp & DFLG) == DFLG
		fV = (temp & VFLG) == VFLG
		fN = (temp & NFLG) == NFLG
		break;	
		
	/* Todo ROL 36,2e,3e */
	
	case 0x2a: /* ROL A */
		t=fC
		fC = ((Acc & 0x80)==0x80)
		Acc=(Acc<<1) &0xFE
		if (t) Acc = Acc | 0x01
		update_zn(Acc)
		break
	case 0x26: /* ROL nn */
		addr=get_byte(PC)
		PC += 1
		M = get_byte(addr)
		t=fC
		fC = ((M & 0x80)==0x80)
		M=(M<<1) &0xFE
		if (t) M = M | 0x01
		update_zn(M)
		put_byte(addr,M)
		break
	case 0x36: /* ROL nn,X */
		addr=(get_byte(PC)+Xreg)&0xff
		PC += 1
		M = get_byte(addr)
		t=fC
		fC = ((M & 0x80)==0x80)
		M=(M<<1) &0xFE
		if (t) M = M | 0x01
		update_zn(M)
		put_byte(addr,M)
		break
	case 0x2e: /* ROL nnnn */
		addr=get_word(PC)
		PC += 2
		M = get_byte(addr)
		t=fC
		fC = ((M & 0x80)==0x80)
		M=(M<<1) &0xFE
		if (t) M = M | 0x01
		update_zn(M)
		put_byte(addr,M)
		break
	case 0x3e: /* ROL nnnn,X */
		addr=get_word(PC)+Xreg
		PC += 2
		M = get_byte(addr)
		t=fC
		fC = ((M & 0x80)==0x80)
		M=(M<<1) &0xFE
		if (t) M = M | 0x01
		update_zn(M)
		put_byte(addr,M)
		break
		
	case 0x6a: /*ROR A */
		t=fC
		fC = ((Acc & 0x01)==0x01)
		Acc=(Acc>>1) & 0x7f
		if (t) Acc = Acc | 0x80
		update_zn(Acc)
		break
	case 0x66:/* ROR nn	*/
		addr=get_byte(PC)
		PC += 1
		M = get_byte(addr)			
		t=fC
		fC = ((M & 0x01)==0x01)
		M=(M>>1) & 0x7f
		if (t) M = M | 0x80		
		put_byte(addr, M)
		update_zn(M)			
		break
	case 0x76:/* ROR nn,X	*/
		addr=(get_byte(PC)+Xreg) & 0xff
		PC += 1
		M = get_byte(addr)		
		t=fC
		fC = ((M & 0x01)==0x01)
		M=(M>>1) & 0x7f
		if (t) M = M | 0x80		
		put_byte(addr, M)
		update_zn(M)			
		break
	case 0x6e:/* ROR nnnn	*/
		addr=get_word(PC)
		PC += 2
		M = get_byte(addr)			
		t=fC
		fC = ((M & 0x01)==0x01)
		M=(M>>1) & 0x7f
		if (t) M = M | 0x80		
		put_byte(addr, M)
		update_zn(M)			
		break
	case 0x7e:/* ROR nnnn,X	*/
		addr=get_word(PC)+Xreg
		PC += 2
		M = get_byte(addr)			
		t=fC
		fC = ((M & 0x01)==0x01)
		M=(M>>1) & 0x7f
		if (t) M = M | 0x80		
		put_byte(addr, M)
		update_zn(M)			
		break
		
	case 0x40: /* RTI */
		temp = pop_byte() 
		fC = (temp & CFLG)==CFLG
		fZ = (temp & ZFLG)==ZFLG
		fI = (temp & IFLG)==IFLG
		fD = (temp & DFLG)==DFLG
		fV = (temp & VFLG)==VFLG
		fN = (temp & NFLG)==NFLG
		
		PC=pop_byte() // LSB
		PC=PC | (pop_byte() <<8)
		break 
		
	case 0x60: /* RTS */
		PC=pop_byte() // LSB
		PC=PC | (pop_byte() <<8)
		PC += 1
		break 
		
	case 0xe9: /* SBC # */
		M = get_byte(PC)						
		Sbc(M) // Acc =  update_flgs_sbc(Acc, M)
		PC += 1
		break
	case 0xe5: /* SBC  nn*/
		M = get_byte(get_byte(PC))					
		Sbc(M) //Acc =  update_flgs_sbc(Acc, M)
		PC += 1
		break
	case 0xf5: /* SBC  nn,X*/
		M = get_byte((get_byte(PC)+Xreg)&0xff)					
		Sbc(M) //Acc =  update_flgs_sbc(Acc, M)
		PC += 1
		break
	case 0xed: /* SBC  nnnn*/
		M = get_byte(get_word(PC))						
		Sbc(M) //Acc =  update_flgs_sbc(Acc, M)
		PC += 2		
		break	
	case 0xfd: /* SBC  nnnn,X*/
		M = get_byte(get_word(PC)+Xreg)						
		Sbc(M) //Acc =  update_flgs_sbc(Acc, M)
		PC += 2		
		break	
	case 0xf9: /* SBC  nnnn,Y*/
		M = get_byte(get_word(PC)+Yreg)						
		Sbc(M) //Acc =  update_flgs_sbc(Acc, M)
		PC += 2		
		break
	case 0xe1: /* SBC  (nn,X)*/
		M = get_byte(get_word((get_byte(PC)+Xreg)&0xff))				
		Sbc(M) //Acc =  update_flgs_sbc(Acc, M)
		PC += 1
		break
	case 0xf1: /* SBC  (nn),Y*/
		M = get_byte(get_word(get_byte(PC))+Yreg)					
		Sbc(M) //Acc =  update_flgs_sbc(Acc, M)
		PC += 1
		break
		
	case 0x38: /* SEC */
		fC=true
		break				
	case 0xF8: /* SED */
		fD=true
		break		
	case 0x78: /* SEI */
		fI=true
		break
		
	case 0x85: /* STA $nn */
		put_byte(get_byte(PC), Acc)
		PC += 1
		break;
	case 0x95: /* STA $nn,X */
		put_byte(((get_byte(PC)+Xreg)&0xff), Acc)
		PC += 1
		break;
	case 0x8D: /* STA $nnnn */
		addr = get_word(PC)
		PC += 2
		put_byte(addr, Acc)
		break;	
	case 0x9D: /* STA $nnnn,X */
		addr = get_word(PC)
		PC += 2
		put_byte(addr+Xreg, Acc)
		break;	
	case 0x99: /* STA $nnnn,Y */
		addr = get_word(PC)
		PC += 2
		put_byte(addr+Yreg, Acc)
		break;	
	case 0x81: /* STA ($nn,x) */
		addr=get_word((get_byte(PC)+Xreg)&0xff)
		put_byte(addr, Acc)
		PC += 1
		break;
	case 0x91: /* STA ($nn),y */
		addr = get_word(get_byte(PC))
		put_byte(addr+Yreg, Acc)
		PC += 1
		break;
						
	case 0x86: /* STX $ */
		put_byte(get_byte(PC), Xreg)
		PC += 1
		break;
	case 0x96: /* STX $nn,Y */
		addr = get_byte(PC)
		put_byte((addr+Yreg)&0xff, Xreg)
		PC += 1
		break;
	case 0x8e: /* STX $nnnn */
		addr = get_word(PC)
		put_byte(addr, Xreg)
		PC += 2
		break;

	case 0x84: /* STY $ */
		put_byte(get_byte(PC), Yreg)
		PC += 1
		break;
	case 0x94: /* STY $nn,X */
		addr = get_byte(PC)
		put_byte((addr+Xreg)&0xff, Yreg)
		PC += 1
		break;
	case 0x8c: /* STY $nnnn */
		addr = get_word(PC)
		put_byte(addr, Yreg)
		PC += 2
		break;
		
	case 0xAA: /* TAX */
		Xreg = Acc
		update_zn(Xreg)
		break;
	case 0xa8: /* TAY */
		Yreg = Acc
		update_zn(Yreg)
		break;
	case 0xbA: /* TSX */
		Xreg = SP
		update_zn(Xreg)
		break;
	case 0x8A: /* TXA */
		Acc=Xreg
		update_zn(Xreg)
		break;
	case 0x9A: /* TXS */
		SP = Xreg
		break;
	case 0x98: /* TYA */
		Acc =Yreg
		update_zn(Yreg)
		break;
		
	default:
		PC = PC-1
		return "? Unknown instruction at $" + hex4(PC) + " - $" + hex2(ins) +"\n"
	}			
	return ""	
}
	
