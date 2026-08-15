/* ==========================================================================
   PROJETO CAMPO TÁTIL - SUPORTE DO MOTOR Y (ENCAIXE NA BARRA 10x10)
   Desliza e trava na barra central 10x10. Segura o motor NEMA Y pelo parafuso.
   ========================================================================== */

$fn = 60;

eixo_quadrado_w = 10.2;  // Encaixe na barra da ponte (10mm + 0.2mm)
nema14_d = 36.5;         // Diâmetro do motor
furo_m3 = 3.2;           // Furo para parafusos M3 de fixação
furos_distancia = 26;    // Distância de 26mm entre centros dos furos M3 do NEMA 14

module suporte_motor_y() {
    difference() {
        // 1. Corpo principal do suporte
        union() {
            // Bloco de encaixe da barra
            cube([22, 20, 16], center=true);
            
            // Placa vertical de suporte do motor que desce
            translate([0, -10 - 2.5, -12])
                cube([40, 5, 40], center=true);
        }
        
        // 2. Canal Quadrado de Encaixe da Ponte 10x10 (Correndo ao longo de Y)
        cube([eixo_quadrado_w, 22, eixo_quadrado_w], center=true);
        
        // 3. Furos de montagem do Motor NEMA 14 (Na placa vertical)
        // Furo central do eixo do motor
        translate([0, -15, -15])
            rotate([90, 0, 0])
                cylinder(h = 10, r = 11, center=true); // Vão do colar central
        
        // Furos para os 4 parafusos M3 do NEMA 14 (Espaçamento de 26mm)
        for (x = [-furos_distancia/2, furos_distancia/2]) {
            for (z = [-furos_distancia/2, furos_distancia/2]) {
                translate([x, -10, -15 + z])
                    rotate([90, 0, 0])
                        cylinder(h = 10, r = furo_m3/2, center=true);
            }
        }
    }
}

suporte_motor_y();
