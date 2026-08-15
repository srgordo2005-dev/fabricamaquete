# Relatório de Limites e Curso Útil do Ímã - Campo Tátil PRO (175x350x60mm)

Este documento registra as cotas mecânicas limites e o curso útil dinâmico do ímã de neodímio N52 (carrinho vermelho) em relação às marcações da tampa superior de futebol.

---

## 📐 1. Eixo X (Esquerda/Direita) - Curso Útil de 80mm

### Componentes Físicos no Eixo X:
* **Largura Interna da Caixa**: $170.0\text{mm}$ (de $x = -85.0\text{mm}$ a $x = 85.0\text{mm}$).
* **Trilhos Lineares Y**: Posicionados em $x = \pm 74.0\text{mm}$.
* **Carrinhos Laterais Y (Laranja)**: Ocupam a faixa de $x = \pm 64.0\text{mm}$ a $x = \pm 84.0\text{mm}$ (largura de $20\text{mm}$).
  - *Vão Livre Interno em X (Espaço entre os dois carrinhos laranjas)*: de $x = -64.0\text{mm}$ a $x = 64.0\text{mm}$ (vão total de **$128.0\text{mm}$**).
* **Carrinho Central X (Vermelho)**: Possui a largura original robusta de **$48.0\text{mm}$** (estendendo-se $24\text{mm}$ para cada lado do centro do ímã).

### Cálculo de Limite Físico de X:
* **Limite Esquerdo Máximo**: Ocorre quando a lateral esquerda do carrinho vermelho ($x_{centro} - 24.0$) encosta na face interna do carrinho laranja esquerdo ($x = -64.0$).
  $$\text{Limite Esquerdo} = -64.0 + 24.0 = -40.0\text{mm}$$
* **Limite Direito Máximo**: Ocorre quando a lateral direita do carrinho vermelho ($x_{centro} + 24.0$) encosta na face interna do carrinho laranja direito ($x = 64.0$).
  $$\text{Limite Direito} = 64.0 - 24.0 = 40.0\text{mm}$$

### Mapeamento do Campo (X):
* **Curso Útil do Ímã em X**: de **$-40.0\text{mm}$ a $40.0\text{mm}$** (Curso total de **$80.0\text{mm}$**).
* **Linhas Laterais Táteis na Tampa**: Posicionadas exatamente em **$x = \pm 40.0\text{mm}$**.
* **Resultado**: O ímã consegue varrer $100\%$ da largura útil do campo de jogo. O limite do curso coincide exatamente com a linha lateral do futebol.

---

## 📐 2. Eixo Y (Frente/Trás) - Curso Útil de 278.8mm (Assimétrico)

### Componentes Físicos no Eixo Y:
* **Comprimento Interno da Caixa**: $345.0\text{mm}$ (de $y = -172.5\text{mm}$ a $y = 172.5\text{mm}$).
* **Paredes da Caixa**: A parede frontal fica em $y = -172.5\text{mm}$ e a traseira em $y = 172.5\text{mm}$.
* **Suportes das Hastes Y (Berço U)**: Ocupam a faixa de $y = \pm 162.5\text{mm}$ a $y = \pm 172.5\text{mm}$ (espessura de $10\text{mm}$).
* **Carrinho Y Lateral (Laranja)**: Comprimento total de $24.0\text{mm}$ ($12\text{mm}$ para frente/trás do centro da ponte).
* **Protuberância do Motor X**: O motor X (NEMA 14) é montado na face frontal do carrinho vermelho. O suporte posiciona o motor com centro em $Y = -26.2\text{mm}$ e raio da carcaça do motor de $18.0\text{mm}$.
  - *Avanço Frontal Máximo do Conjunto Móvel*: O motor X sobressai **$44.2\text{mm}$** para a frente do centro da ponte móvel ($26.2\text{mm} + 18.0\text{mm}$).

### Cálculo de Limite Físico de Y (Colisão):
* **Limite Frontal Máximo (Jogador A)**: Ocorre quando a face frontal do motor X ($y_{ponte} - 44.2$) colide com a parede interna frontal da caixa ($y = -172.5$).
  $$\text{Limite Frontal (Ímã)} = -172.5 + 44.2 = -128.3\text{mm}$$
* **Limite Traseiro Máximo (Jogador B)**: Ocorre quando a face traseira do carrinho laranja ($y_{ponte} + 12.0$) encosta na face interna do suporte Berço U traseiro ($y = 162.5$).
  $$\text{Limite Traseiro (Ímã)} = 162.5 - 12.0 = 150.5\text{mm}$$

### Mapeamento do Campo (Y):
* **Curso Útil do Ímã em Y**: de **$-128.3\text{mm}$ a $150.5\text{mm}$** (Curso total de **$278.8\text{mm}$**).
* **Linhas de Fundo de Jogo (Gols)**: Posicionadas simetricamente a **$y = \pm 125.0\text{mm}$** absoluto.
* **Grande Área**:
  - Grande Área Frontal: de $y = -125.0\text{mm}$ a $y = -95.0\text{mm}$.
  - Grande Área Traseira: de $y = 95.0\text{mm}$ a $y = 125.0\text{mm}$.

### Verificação de Alcance nos Gols:
* **No Gol Frontal (Jogador A)**:
  * O ímã consegue ir até $Y = -128.3\text{mm}$. A linha do gol está em $Y = -125.0\text{mm}$.
  * **O ímã passa da linha do gol por $3.3\text{mm}$ para dentro da rede**, garantindo a simulação completa de gol!
* **No Gol Traseiro (Jogador B)**:
  * O ímã consegue ir até $Y = 150.5\text{mm}$. A linha do gol está em $Y = 125.0\text{mm}$.
  * **O ímã passa da linha do gol por $25.5\text{mm}$**, dando folga extrema para escanteio e profundidade de rede!

## 🏁 Conclusão da Análise Física:
O projeto de **$175\times350\text{mm}$** com carrinho vermelho de **$48\text{mm}$** e furos avançados a **$Y = -26.2\text{mm}$** funciona perfeitamente:
1. O ímã **consegue alcançar e cruzar a linha de gol em ambas as pontas** (sem parar antes, como ocorria na versão anterior).
2. O ímã cobre **$100\%$ da Grande Área e da Pequena Área** de ambos os jogadores.
3. As marcações do campo de $80\times250\text{mm}$ estão totalmente integradas aos limites reais da mecânica.
