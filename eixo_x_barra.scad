/* ==========================================================================
   PROJETO CAMPO TÁTIL - EIXO METÁLICO X (hardware comprado)
   Representação 3D do Eixo de Aço X de 10x10x164mm da ponte para montagem/fatiamento
   ========================================================================== */

$fn = 60;

module barra_quadrada_x() {
    color("silver")
        cube([164, 10, 10], center=true);
}

// Renderiza centralizado no plano Z=0
translate([0, 0, 5])
    barra_quadrada_x();
