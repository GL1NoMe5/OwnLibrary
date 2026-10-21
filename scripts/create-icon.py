from PIL import Image, ImageDraw
from pathlib import Path
root = Path(__file__).resolve().parent.parent / 'resources'
root.mkdir(exist_ok=True)
image = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((12, 12, 1012, 1012), 220, fill='#69785e')
draw.rounded_rectangle((80, 80, 944, 944), 160, outline='#b8bd9b', width=4)
draw.polygon([(210, 303), (310, 290), (512, 355), (715, 290), (814, 303), (814, 717), (692, 699), (512, 762), (333, 699), (210, 717)], fill='#d5c7a0')
draw.polygon([(230, 274), (330, 262), (500, 325), (500, 716), (330, 655), (230, 670)], fill='#f0e8cd')
draw.polygon([(524, 325), (694, 262), (794, 274), (794, 670), (694, 655), (524, 716)], fill='#e7dbb7')
for offset in range(5):
    y = 375 + offset * 49
    draw.line([(281, y), (448, y + 45)], fill='#c7b993', width=5)
    draw.line([(573, y + 45), (742, y)], fill='#beb087', width=5)
draw.line([(512, 359), (512, 733)], fill='#a3936c', width=7)
draw.line([(664, 520), (709, 390), (763, 322)], fill='#6e8061', width=12)
draw.ellipse((632, 415, 703, 461), fill='#8d9b71')
draw.ellipse((714, 352, 783, 398), fill='#7d9168')
draw.ellipse((683, 329, 730, 395), fill='#a0aa80')
image.save(root / 'icon.png')
image.save(root / 'icon.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
