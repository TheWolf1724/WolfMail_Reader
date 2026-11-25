"""Genera los iconos de WolfMail (PNG 512 y .ico multiresolucion) con Pillow.
Dibujo propio: sobre azul con solapa y una marca de cabeza de lobo estilizada. Sin recursos de terceros.
Uso: python3 scripts/generar_icono.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

AZUL = (11, 92, 173, 255)
BLANCO = (255, 255, 255, 255)
GRIS = (214, 228, 244, 255)
OUT = Path(__file__).resolve().parent.parent / "build"


def dibujar(n: int) -> Image.Image:
    s = 4  # sobremuestreo para bordes suaves
    N = n * s
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = N / 16
    d.rounded_rectangle((0.5 * u, 0.5 * u, 15.5 * u, 15.5 * u), radius=3 * u, fill=AZUL)
    # Sobre
    d.rounded_rectangle((2.6 * u, 4.4 * u, 13.4 * u, 11.8 * u), radius=1 * u, fill=BLANCO)
    d.polygon([(2.9 * u, 4.9 * u), (13.1 * u, 4.9 * u), (8 * u, 9.1 * u)], fill=GRIS)
    d.line([(2.9 * u, 4.9 * u), (8 * u, 9.1 * u), (13.1 * u, 4.9 * u)], fill=AZUL, width=max(1, int(0.55 * u)), joint="curve")
    # Orejas de lobo sobre el sobre
    d.polygon([(2.6 * u, 4.4 * u), (3.4 * u, 1.9 * u), (5.6 * u, 4.4 * u)], fill=BLANCO)
    d.polygon([(13.4 * u, 4.4 * u), (12.6 * u, 1.9 * u), (10.4 * u, 4.4 * u)], fill=BLANCO)
    return img.resize((n, n), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
dibujar(512).save(OUT / "icon.png")
dibujar(256).save(OUT / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("Iconos generados en", OUT)
