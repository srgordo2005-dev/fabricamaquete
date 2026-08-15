import adsk.core, adsk.fusion, traceback

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui  = app.userInterface
        
        # --- PARÂMETROS DO DESIGN (Milímetros convertidos para cm) ---
        largura = 24.0      # 240mm
        comprimento = 16.0  # 160mm
        altura = 2.6        # 26mm
        parede = 0.25       # 2.5mm
        furo_m3 = 0.3       # 3.0mm

        design = app.activeProduct
        rootComp = design.rootComponent
        
        # 1. ESBOÇO DA BASE EXTERNA
        sketches = rootComp.sketches
        xyPlane = rootComp.xYConstructionPlane
        sketchBase = sketches.add(xyPlane)
        
        # Desenhar retângulo do fundo
        sketchBase.sketchCurves.sketchLines.addTwoPointRectangle(
            adsk.core.Point3D.create(-largura/2, -comprimento/2, 0),
            adsk.core.Point3D.create(largura/2, comprimento/2, 0)
        )
        
        # 2. EXTRUDIR FUNDO
        extrudes = rootComp.features.extrudeFeatures
        profBase = sketchBase.profiles.item(0)
        extInput = extrudes.createInput(profBase, adsk.fusion.FeatureOperations.NewBodyFeatureOperation)
        distance = adsk.core.ValueInput.createByReal(parede)
        extInput.setDistanceExtent(False, distance)
        extBase = extrudes.add(extInput)
        
        # 3. CRIAR AS PAREDES SUBINDO
        sketchWalls = sketches.add(xyPlane)
        sketchWalls.sketchCurves.sketchLines.addTwoPointRectangle(
            adsk.core.Point3D.create(-largura/2, -comprimento/2, 0),
            adsk.core.Point3D.create(largura/2, comprimento/2, 0)
        )
        sketchWalls.sketchCurves.sketchLines.addTwoPointRectangle(
            adsk.core.Point3D.create(-largura/2 + parede, -comprimento/2 + parede, 0),
            adsk.core.Point3D.create(largura/2 - parede, comprimento/2 - parede, 0)
        )
        
        profWalls = sketchWalls.profiles.item(0)
        extInputWall = extrudes.createInput(profWalls, adsk.fusion.FeatureOperations.JoinFeatureOperation)
        distWall = adsk.core.ValueInput.createByReal(altura)
        extInputWall.setDistanceExtent(False, distWall)
        extrudes.add(extInputWall)

        # 4. CRIAR SUPORTES DE PARAFUSOS NOS CANTOS
        sketchPosts = sketches.add(xyPlane)
        posicoes = [
            (-largura/2 + 0.8, -comprimento/2 + 0.8),
            (largura/2 - 0.8, -comprimento/2 + 0.8),
            (-largura/2 + 0.8, comprimento/2 - 0.8),
            (largura/2 - 0.8, comprimento/2 - 0.8)
        ]
        
        for pos in posicoes:
            sketchPosts.sketchCurves.sketchCircles.addByCenterRadius(
                adsk.core.Point3D.create(pos[0], pos[1], 0), 0.4
            )
            sketchPosts.sketchCurves.sketchCircles.addByCenterRadius(
                adsk.core.Point3D.create(pos[0], pos[1], 0), furo_m3/2
            )
            
        for i in range(sketchPosts.profiles.count):
            prof = sketchPosts.profiles.item(i)
            extInputPost = extrudes.createInput(prof, adsk.fusion.FeatureOperations.JoinFeatureOperation)
            distPost = adsk.core.ValueInput.createByReal(altura)
            extInputPost.setDistanceExtent(False, distPost)
            extrudes.add(extInputPost)

        ui.messageBox('Gabinete Base gerado com sucesso!')
        
    except:
        if ui:
            ui.messageBox('Falha:\n{}'.format(traceback.format_exc()))
