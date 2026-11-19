# Política de Segurança — MRQ Estudo Musical

## Versões Suportadas

| Versão | Suporte de Segurança |
| ------ | -------------------- |
| 1.0.x  | :white_check_mark: Ativo |

## Privacidade & Modelo Local-First

- O **MRQ Estudo Musical** processa arquivos de áudio, análises musicais, transcrições MIDI e projetos SQLite **100% localmente** no dispositivo do usuário.
- Nenhum arquivo de áudio é enviado a servidores externos.
- O único acesso opcional à rede ocorre quando o usuário solicita explicitamente o download de modelos ONNX pelo *Gerenciador de Modelos IA* ou verifica atualizações.
- O aplicativo não armazena credenciais nem realiza extração não autorizada de plataformas de terceiros.

## Como Reportar uma Vulnerabilidade

Se você identificar uma vulnerabilidade de segurança (por exemplo, falha de memória no núcleo C++17 DSP, execução arbitrária via arquivo de áudio malformado ou falha na API local):

1. **Não abra uma issue pública** contendo detalhes exploráveis.
2. Utilize a aba **Security → Advisories → Report a vulnerability** no repositório oficial do GitHub (`MQueirozair/MRQ-Estudo-Musical`).
3. Inclua:
   - Descrição clara do problema e impacto potencial;
   - Passos mínimos para reprodução (ou arquivo/amostra sintética);
   - Versão do sistema operacional e do MRQ Estudo Musical.

Responderemos com confirmação de recebimento e cronograma de correção assim que possível.
