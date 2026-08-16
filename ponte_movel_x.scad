/* ==========================================================================
   PROJETO CAMPO TÁTIL - CREMALHEIRA DA PONTE X (141.0mm COMPRIMENTO)
   Peça de 141.0mm alinhada em Y = -17.5mm para máxima folga do motor X
   Orientada de ponta-cabeça para suporte zero na mesa de impressão
   ========================================================================== */

$fn = 60;
furo_m3 = 3.4;

module ponte_movel_x_impressao() {
    // Rotaciona a ponte para que as torres apontem para cima (+Z) e a base fique 100% plana na mesa
    rotate([180, 0, 0]) translate([0, 0, -0.55]) {
        union() {
        difference() {
            union() {
                // Viga principal da cremalheira (141.0mm de comprimento, Y = -17.5mm)
                translate([0, -17.5, 0.55])
                    cube([141.0, 10, 5], center=true);
                
                // NOVO SUPORTE UNIFICADO E RIGIDO PARA MOTOR Y (IGUAL AO DO CARRINHO X)
                // Centrado em X = -8.0, Y = -28.5. Espessura de 5.0mm (alinhado com a viga)
                translate([-8.0, -28.5, 0.55])
                    cube([54, 32, 5.0], center=true);
                    
                // Mãos-francesas horizontais de reforço (Gussets) no plano X-Y
                translate([-35.0, -12.5, -1.95]) {
                    linear_extrude(height = 5.0) {
                        polygon(points=[[0, 0], [4, 0], [0, -10]]);
                    }
                }
                translate([19.0, -12.5, -1.95]) {
                    linear_extrude(height = 5.0) {
                        polygon(points=[[0, 0], [-4, 0], [0, -10]]);
                    }
                }
            }
            
            // Furo central do colar do NEMA 14 Redondo (23mm de diâmetro) para assentar plano
            translate([-8.0, -29.4, 0.55])
                cylinder(h = 10, r = 11.5, center=true);
                
            // Dois furos de fixação M3 com espaçamento de 46mm para o NEMA 14 Redondo
            translate([-31.0, -29.4, 0.55])
                cylinder(h = 10, r = furo_m3/2, center=true);
            translate([15.0, -29.4, 0.55])
                cylinder(h = 10, r = furo_m3/2, center=true);
        }
        }
        
        // Dentes da Cremalheira X na face frontal (-Y)
        for (x = [-67.5 : 2.0 : 67.5]) {
            translate([x, -23.0, 0.55])
                cube([1.2, 1.0, 5.0], center=true);
        }
    }
}

// Renderiza a peça pronta para fatiar no plano Z=0
translate([0, 17.5, 1.95])
    ponte_movel_x_impressao();
