/* ==========================================================================
   PROJETO CAMPO TÁTIL - PINOS DE ENCAIXE SEPARADOS (8 PEÇAS)
   Diâmetro: 2.8mm | Altura: 5.0mm
   Impressão dos pinos em pé diretamente na mesa para posterior colagem
   ========================================================================== */

$fn = 60;

module pino_individual() {
    // Cilindro assentado no plano Z=0
    cylinder(h = 5.0, r = 1.4);
}

module grade_de_pinos() {
    // Organiza 8 pinos em uma grade 2x4 com espaçamento de 10mm para imprimir fácil
    for (x = [0 : 1 : 1]) {
        for (y = [0 : 1 : 3]) {
            translate([x * 10, y * 10, 0])
                pino_individual();
        }
    }
}

grade_de_pinos();
