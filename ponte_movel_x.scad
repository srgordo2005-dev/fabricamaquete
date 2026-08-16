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
            // Viga principal da cremalheira (141.0mm de comprimento, Y = -17.5mm)
            translate([0, -17.5, 0.55])
                cube([141.0, 10, 5], center=true);
            
            // Coluna de Fixação Esquerda do motor Y (x = -21.0mm)
            translate([-21.0, -14.5, (0.55 - 9.0)/2])
                cube([7, 6, 0.55 + 9.0], center=true);
            translate([-21.0, -8.5, -9.0 + 1.5]) {
                difference() {
                    cylinder(h = 3, r = 3.5, center=true);
                    cylinder(h = 4, r = furo_m3/2, center=true);
                }
            }

            // Coluna de Fixação Direita do motor Y (x = 5.0mm)
            translate([5.0, -14.5, (0.55 - 9.0)/2])
                cube([7, 6, 0.55 + 9.0], center=true);
            translate([5.0, -8.5, -9.0 + 1.5]) {
                difference() {
                    cylinder(h = 3, r = 3.5, center=true);
                    cylinder(h = 4, r = furo_m3/2, center=true);
                }
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
