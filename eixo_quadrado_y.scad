/* ==========================================================================
   PROJETO CAMPO TÁTIL - BARRAS LINEARES QUADRADAS DO EIXO Y (10x10x175mm)
   Eixo guia da ponte móvel que corre no sentido X (esquerda para a direita)
   ========================================================================== */

largura_barra = 10;       
altura_barra = 10;        
comprimento_barra = 175;  // Comprimento correto de esquerda a direita

module barra_quadrada_y() {
    color("silver")
        translate([0, 0, altura_barra/2])
            cube([comprimento_barra, largura_barra, altura_barra], center=true);
}

barra_quadrada_y();
