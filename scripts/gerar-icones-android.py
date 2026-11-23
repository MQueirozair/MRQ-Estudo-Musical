#!/usr/bin/env python3
"""Gera os ícones do launcher Android e as telas de splash a partir de build/icon.png."""
from PIL import Image
from pathlib import Path

raiz = Path(__file__).resolve().parent.parent
origem = Image.open(raiz / 'build/icon.png').convert('RGBA')
res = raiz / 'android/app/src/main/res'
FUNDO = (7, 11, 20, 255)  # #070B14

# tamanhos por densidade (launcher legado + foreground do adaptive icon)
densidades = {
    'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192,
}

for dens, tam in densidades.items():
    pasta = res / f'mipmap-{dens}'
    pasta.mkdir(parents=True, exist_ok=True)

    # ícone "legado": quadrado arredondado
    icone = origem.resize((tam, tam), Image.LANCZOS)
    icone.save(pasta / 'ic_launcher.png')
    icone.save(pasta / 'ic_launcher_round.png')

    # foreground do adaptive icon precisa de margem de segurança (~66% do canvas)
    canvas = Image.new('RGBA', (int(tam * 1.5), int(tam * 1.5)), (0, 0, 0, 0))
    interno = origem.resize((tam, tam), Image.LANCZOS)
    canvas.paste(interno, (int(tam * 0.25), int(tam * 0.25)), interno)
    canvas.save(pasta / 'ic_launcher_foreground.png')

# splash: fundo escuro com o ícone centralizado
for pasta in res.glob('drawable*'):
    if 'v24' in pasta.name:
        continue
    splash_atual = pasta / 'splash.png'
    if not splash_atual.exists():
        continue
    largura, altura = Image.open(splash_atual).size
    tela = Image.new('RGBA', (largura, altura), FUNDO)
    lado = int(min(largura, altura) * 0.32)
    icone = origem.resize((lado, lado), Image.LANCZOS)
    tela.paste(icone, ((largura - lado) // 2, (altura - lado) // 2), icone)
    tela.save(splash_atual)

# fundo do adaptive icon
(res / 'values/ic_launcher_background.xml').write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">#070B14</color>\n</resources>\n',
    encoding='utf-8',
)
print('✓ ícones e splash gerados')
