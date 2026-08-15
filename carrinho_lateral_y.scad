/* ==========================================================================
   PROJETO CAMPO TÁTIL - CARRINHO LATERAL Y (SLIDER ESTREITO DE 14mm)
   Gera peças individuais Esquerda ou Direita para fatiamento (Bambu Lab)
   Suportes da cremalheira X estreitados para 8.25mm (Evita colisão com o eixo Y)
   ========================================================================== */

/* [Tipo de Peça] */
// Selecione se deseja gerar o carrinho esquerdo ou o direito
tipo_carrinho = "esquerdo"; // [esquerdo: Carrinho Esquerdo, direito: Carrinho Direito]

$fn = 60;

module carrinho_lateral_y(braco_interno_esquerdo=true) {
    // desloc_x_suporte do pocket vai para 9.0mm relativo
    // desloc_x_centro_braco vai para 9.375mm relativo (médio de 5.25 e 13.5)
    desloc_x_suporte = braco_interno_esquerdo ? 9.0 : -9.0;
    desloc_x_centro_braco = braco_interno_esquerdo ? 9.375 : -9.375;
    
    difference() {
        union() {
            // Corpo principal original de 24mm em Y
            translate([0, 0, 12]) 
                cube([14, 24, 24], center=true);
            
            // Prolongador interno rebaixado em Z (Largura reduzida para 8.25mm, folga do eixo Y)
            translate([desloc_x_centro_braco, -13.0, 0.55 + 1.5])
                cube([8.25, 10, 8.0], center=true);
        }
        
        // Canal passante interno para o eixo quadrado Y (10.3mm - Spans X = -5.15 a 5.15)
        translate([0, 0, 1.5 + 10.3/2]) 
            cube([10.3, 26, 10.3], center=true);
            
        // Eixo Único da Ponte X (Y = 0mm)
        translate([0, 0, 13.5 + 10.1/2]) 
            cube([16, 10.1, 10.1], center=true);
        
        // Bolsa fêmea de 5.0mm (Vai de ±66.0mm a ±71.0mm absoluto)
        translate([desloc_x_suporte, -13.0, 0.55])
            cube([5.2, 10.2, 5.2], center=true);
    }
}

// RENDERIZAR A PEÇA ESCOLHIDA NO CENTRO DE IMPRESSÃO
if (tipo_carrinho == "esquerdo") {
    carrinho_lateral_y(braco_interno_esquerdo=true);
} else {
    carrinho_lateral_y(braco_interno_esquerdo=false);
}
