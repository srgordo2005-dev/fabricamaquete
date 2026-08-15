/* ==========================================================================
   PROJETO CAMPO TÁTIL - EIXO METÁLICO Y (hardware comprado)
   Representação 3D do Eixo de Aço Y de 10x10x345mm para montagem/fatiamento
   ========================================================================== */

$fn = 60;

module barra_quadrada_y() {
    color("silver")
        cube([10, 345, 10], center=true);
}

// Renderiza centralizado no plano Z=0
translate([0, 0, 5])
    barra_quadrada_y();
