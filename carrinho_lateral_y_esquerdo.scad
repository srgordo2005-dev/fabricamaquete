/* ==========================================================================
   PROJETO CAMPO TÁTIL - CARRINHO LATERAL Y (METADE ESQUERDA DE IMPRESSÃO)
   Berço da cremalheira em U totalmente aberto para cima e para a direita (centro do campo)
   Pronto para fatiar direto na Bambu Lab A1 Mini (Suporte Zero)
   ========================================================================== */

$fn = 60;

module carrinho_lateral_y_esquerdo() {
    desloc_x_centro_braco = 9.375;
    
    difference() {
        union() {
            // Corpo principal original de 24mm em Y (spans Y = -12 a 12mm)
            translate([0, 0, 12]) 
                cube([14, 24, 24], center=true);
            
            // Prolongador interno com altura estendida para baixo em Z (total 10.0mm de altura)
            // Z de -3.95mm a 6.05mm relativo. Centralizado em Y = -17.25mm
            translate([desloc_x_centro_braco, -17.25, 1.05])
                cube([8.25, 10.5, 10.0], center=true);
                
            // Nervura triangular de reforço em X-Y (Mão-Francesa lateral estendida em Z)
            translate([0, 0, 1.05]) {
                linear_extrude(height = 10.0, center = true) {
                    polygon(points = [
                        [7.0, -12.0],
                        [7.0, -17.5],
                        [13.5, -17.5]
                    ]);
                }
            }
        }
        
        // Canal passante interno para o eixo quadrado Y (10.3mm - Spans X = -5.15 a 5.15)
        translate([0, 0, 1.5 + 10.3/2]) 
            cube([10.3, 26, 10.3], center=true);
            
        // Eixo Único da Ponte X (Y = 0mm)
        translate([0, 0, 13.5 + 10.1/2]) 
            cube([16, 10.1, 10.1], center=true);
        
        // Canal de Encaixe em U Aberto por Cima E Aberto para a Direita (Centro do Campo)
        // Corta tudo a partir de X = 6.4mm em direção ao lado direito (+X)
        // Corta de Z = -2.0mm até acima do topo do suporte
        translate([10.7, -17.5, 3.0])
            cube([8.6, 10.2, 10.0], center=true);
    }
}

// Renderiza a peça pronta para fatiar
carrinho_lateral_y_esquerdo();
