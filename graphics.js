/*
<table id="screen" style="border:4px solid green">
<tbody>
<tr tabindex=0 id=kscreen>
<td class="teletext">
	<div id=VDU class="teletext">TEXT SCREEN</div>
	<canvas width="500" height="300" class="myCanvas" style="display: none">Atom Graphics screen</canvas>
</td>
</tr>
</tbody>
</table>
*/

const MAX_VMEM = 6 * 1024
const VGmem  = new Array(MAX_VMEM) // MAX MEM needed 6K !
const canvas = document.querySelector(".myCanvas");
const width  = (canvas.width) //  = window.innerWidth);
const height = (canvas.height) // = window.innerHeight);

const ctx = canvas.getContext("2d");

const Modes = {}

Modes[0] = [64,  48,     512]
Modes[1] = [128, 64,    1024]
Modes[2] = [128, 96,    1536]
Modes[3] = [128, 192, 3*1024]
Modes[4] = [256, 192, MAX_VMEM]

const cset= "@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^- !\"#$%\&'()*+,-./0123456789:;<=>?" 

var VGmode=0 // default to mode zero
var memchng=false

function VGget_byte(addr) 
{
	return VGmem[addr & 0x1FFF]
}

function VGput_byte(addr, v) 
{
	memchng=true
	VGmem[addr & 0x1FFF] = v
}	

function cvtgc(n)
{
	n1=0
	if ((n & 0x20)== 0x20) n1 |= 1
	if ((n & 0x10)== 0x10) n1 |= 2
	if ((n & 0x08)== 0x08) n1 |= 4
	if ((n & 0x04)== 0x04) n1 |= 8
	if ((n & 0x02)== 0x02) n1 |= 0x10
	if ((n & 0x01)== 0x01) n1 |= 0x20		
	return n1
}

function VDUgraphic()
{
	if (VGmode > 0) {
	
		if (memchng==false)
			return
			
		memchng = false
	
		ctx.fillStyle = "rgb(0, 0, 0)"
		ctx.fillRect(0, 0, width, height);
		
		mx = Modes[VGmode][0]
		my = Modes[VGmode][1]
		sz = Modes[VGmode][2]

		pw = (width / mx)
		ph = (height / my)
		
		ctx.fillStyle = "rgb(255,255,255)"
					
		for (i=0; i< sz; i++)	// foreach memory location
		{
			B = VGget_byte(i)
			Mask=0x80
			x = (i * 8) % mx
			y = Math.round((i * 8) / mx) % my
			for (j=0; j<8; j++) // foreach bit
			{
				if ((B & Mask)==Mask)
				{	
					xt = x + j
					//print_mon("Set bit x="+xt + " y="+y + ".. " + width + ": " + height + "\n")		
					//print_mon("Set px (" + pw + "," + ph +", (" + Math.round(xt*pw) + "," + Math.round(y*ph) +")\n")
					ctx.fillRect(Math.round(xt*pw),Math.round(y*ph),Math.round(pw),Math.round(ph)); // 		
				}
				Mask =  (Mask>> 1)
			}
		}		
	}
	return
}
	
function VDUtotext() 
{	
	if (VGmode == 0)
	{
		var i,j,str=""
		for (j=0; j<16;j++) 
		{
			for (i=0;i<32;i++) 
			{
				var ch = VGmem[j*32+i]
				if (ch==0x1b)
					str = str + String.fromCharCode(0x7b)  //[
				else
				if (ch==0x1d)
					str = str + String.fromCharCode(0x7d) //]
				else
				if (ch>=0 && ch<=0x3f) 	
					str = str + cset[ch]
				else
				if (ch>=0x80 && ch<=0xbf) 	
					str = str + "<span class=\"black whitebg\">" + cset[ch-0x80]+"</span>"
				else
				if (ch>=0x40 && ch<=0x7f) 	
					str = str + "<span class=\"white blackbg\">&#" + (cvtgc(ch-0x40)+0xe200)+";</span>"
				else
				if (ch>=0xc0 && ch<=0xff) 	
					str = str + "<span class=\"yellow blackbg\">&#"+ (cvtgc(ch-0xc0)+0xe200)+";</span>"

			}
			str = str + "\n"
		}
		return str
	}
	else
		VDUgraphic()
		
	return ""
}


function set_graphics_mode(GM)
{
	x=0
	if (GM==15)
		x=4
	else if (GM==13)
		x=3
	else if (GM==7)
		x=2
	else if (GM==3)
		x=1
			
	if (VGmode==x) return
	VGmode=x
	
	print_mon("Mode = " + VGmode + "\n")	
	if (VGmode==0) {
		document.getElementById("VDU").style.display="block"
		canvas.style.display = "none"
		document.getElementById("VDU").innerHTML= VDUtotext()
	}
	else
	{
		document.getElementById("VDU").style.display="none"
		canvas.style.display= "block"
		
		//const ctx = canvas.getContext("2d");
		ctx.fillStyle = "rgb(0, 0, 0)"
		ctx.fillRect(0, 0, width, height);
	}	
}

function clear_screen () {
	print_mon("clear mode "+VGmode+ "(" + Modes[VGmode][0] + "," + Modes[VGmode][1] +")\n")
	
	v =  (VGmode==0)?0x40:0
	
	for (i=0; i<Modes[VGmode][2]; i++)  // clear VDG mem
		VGmem[i]= v
		
	ctx.fillStyle = "rgb(0, 0, 0)"
	ctx.fillRect(0, 0, width, height);
}

/*
		if (r[0]=="MODE") {
			if (r.length<2)
			{
				print_mon("mode ="+VGmode+ "(" + Modes[VGmode][0] + "," + Modes[VGmode][1] +")\n")
			}
			else
				set_graphics_mode(r[1])				
		}
		else if (r[0]=="CLR") {		
			clear_screen()
		}
*/