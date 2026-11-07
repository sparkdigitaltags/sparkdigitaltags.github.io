import math, io, sys, json, urllib.request
from PIL import Image
def tile(lat, lon, z):
    n = 2 ** z; x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y
cfg = json.load(open('tools/maps.json'))
for m in cfg:
    z = m['zoom']; cx, cy = tile(m['lat'], m['lon'], z)
    w, h = m['tiles_w'], m['tiles_h']
    x0, y0 = int(cx - w / 2), int(cy - h / 2)
    img = Image.new('RGB', (w * 256, h * 256))
    for i in range(w):
        for j in range(h):
            url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y0+j}/{x0+i}"
            req = urllib.request.Request(url, headers={'User-Agent': 'spark-tags-map/1.0'})
            img.paste(Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert('RGB'), (i * 256, j * 256))
    img.save(f"maps/{m['name']}.jpg", quality=88)
    json.dump({'zoom': z, 'x0': x0, 'y0': y0, 'w': w * 256, 'h': h * 256, 'lat': m['lat'], 'lon': m['lon']}, open(f"maps/{m['name']}.json", 'w'))
    print(m['name'], img.size)
