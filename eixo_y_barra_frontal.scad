/* ==========================================================================
   PROJETO CAMPO TÁTIL - METADE FRONTAL DO EIXO GUIA Y (IMPRESSÃO DIAGONAL)
   Barra de 10x10mm dividida com emenda de 20mm e pinos de filamento 1.75mm
   Para imprimir na A1 Mini: Rotacione a peça em 45 graus na mesa de impressão
   ========================================================================== */

$fn = 60;

module eixo_y_barra_frontal() {
    difference() {
        // Corpo da barra de Y = -172.5mm até Y = 10.0mm (Comprimento total: 182.5mm)
        translate([0, -81.25, 5])
            cube([10, 182.5, 10], center=true);
            
        // Corte da metade superior da emenda (Z de 5.0 a 10.0mm na faixa Y de -10 a 10mm)
        translate([0, 0, 7.5])
            cube([12, 20.0, 5.0], center=true);
            
        // Furos de guia para pinos de filamento 1.75mm (diâmetro de 2.0mm para encaixe justo)
        // Posicionados na linha central Z = 5.0mm nas cotas Y = -5mm e Y = 5mm
        translate([0, -5.0, 5.0])
            cylinder(h = 8.0, r = 1.0, center=true);
        translate([0, 5.0, 5.0])
            cylinder(h = 8.0, r = 1.0, center=true);
    }
}

// Renderiza a peça pronta para exportação
eixo_y_barra_frontal();
