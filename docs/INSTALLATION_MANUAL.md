# Manual de Instalação — MRQ Estudo Musical

## Requisitos Mínimos de Sistema

- **Windows**: Windows 10/11 64-bit, 4 GB RAM (8 GB recomendado para modelos neurais ONNX), 500 MB livres.
- **macOS**: macOS 12+ (Apple Silicon M1/M2/M3/M4 ou Intel x86_64), 4 GB RAM, 500 MB livres.
- **Android**: Android 7.0 (API 24) ou superior, arquitetura ARM64 ou ARMv7, 2 GB RAM.
- **Linux**: Distribuição x86_64 moderna (Debian/Ubuntu/Fedora/Arch), glibc 2.31+, 4 GB RAM.

---

## Instalação no Windows

1. Baixe `MRQ-Estudo-Musical-Setup-1.0.0-x64.exe` (ou `.msi`) na página de Releases do projeto.
2. Execute o instalador e aceite o contrato de licença MIT.
3. Escolha a pasta de instalação (padrão: `C:\Program Files\MRQ Estudo Musical`).
4. O instalador cria automaticamente os atalhos na **Área de Trabalho** e no **Menu Iniciar**, além de registrar o desinstalador oficial em *Configurações → Aplicativos*.
5. Abra o **MRQ Estudo Musical** pelo atalho.

## Instalação no macOS

1. Baixe `MRQ-Estudo-Musical-1.0.0-universal.dmg`.
2. Dê duplo clique no `.dmg` e arraste **MRQ Estudo Musical.app** para a pasta **Aplicativos (`/Applications`)**.
3. Na primeira abertura (caso o build não tenha sido notarizado com certificado Apple Developer), clique com o botão direito sobre o aplicativo e selecione **Abrir**.

## Instalação no Android

1. Baixe `app-release.apk` (ou instale via Google Play usando o pacote `.aab`).
2. Permita a instalação de apps confiáveis caso instale o APK diretamente.
3. Ao abrir, conceda permissão de leitura de arquivos de áudio (`READ_MEDIA_AUDIO`) para importar suas músicas locais.

## Instalação a partir do Código-Fonte (Desenvolvedores)

```bash
git clone https://github.com/MQueirozair/MRQ-Estudo-Musical.git
cd MRQ-Estudo-Musical
bash scripts/setup.sh
make run
```

## Download Opcional de Modelos de IA Offline

Após abrir o aplicativo:
1. Acesse o menu **Ferramentas → Gerenciador de Modelos de IA Offline (ONNX)**.
2. Verifique a compatibilidade de RAM do seu dispositivo.
3. Baixe opcionalmente `Basic Pitch (ONNX)` ou `HTDemucs 4-Stems (ONNX)`.
4. Após o download, **nenhuma conexão com a internet é necessária** — todo o processamento ocorre localmente.
