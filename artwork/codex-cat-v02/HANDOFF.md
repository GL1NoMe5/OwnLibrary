# Спящий рыжий кот · новая модель

Модель построена с нуля в активном Blender 5.2.3 через MCP. Геометрия прежнего кота и заготовки Flash не использована. С нуля созданы корпус, голова, мордочка, лапы, ушные раковины, хвост, скелет, веса и направленный мех.

## Файлы

- `source/sanctuary-cat.blend` — редактируемый исходник с упакованными текстурами, анимациями и светом для просмотра.
- `../../src/renderer/public/room/sanctuary-cat.glb` — основной GLB приложения.
- `scripts/build_cat.py` — воспроизводимая сборка из пустой сцены; `build()` заменяет содержимое активного Blender, поэтому сначала сохраните другую работу.
- `scripts/blender_helpers.py` — общие функции геометрии, материалов и анимации. Готовой геометрии кота здесь нет.
- `scripts/bake_coat.py` — запекание плавного перехода мордочки и шерсти в текстуру 4096² без света и теней.
- `scripts/sculpt_body.py` — сглаженный анатомический переход спины, бока и поджатых лап с сохранением UV и весов.
- `previews/cat-in-room.png` — снимок предыдущей итерации GLB в настоящем рендерере SanctuaryScene; сделан до исправления ушей и последней доводки корпуса.
- `previews/room-overview.png` — общий вид комнаты предыдущей итерации.
- `previews/body-refined.png` — актуальный корпус версии 1.3.3, рендер Blender без открытия окон.
- `previews/cat-portrait.png` — отдельный Blender Cycles render; освещение отличается от приложения.

## Изменения

Вытянутый согнутый корпус, асимметрично поджатые лапы, сужающийся хвост, низкая голова с носовой спинкой и закрытыми веками. Короткая шерсть использует детальную текстуру, normal map и отдельную геометрию по силуэту. Мех рассчитан прежде всего на существующие передние камеры комнаты. Микроволоски не отбрасывают и не принимают дискретную shadow map; обычную тень сохраняет основной меш. Дополнительный слабый отражённый свет помогает видеть мордочку перед камином.

## Совместимость и размер

Положение `[-0.36, 0.056, -0.52]`, поворот Y `14.32°`, масштаб 1. Сохранены `Cat_Armature`, `Cat_Mesh` и семь имён костей. Добавлен `Cat_Fur`.

Два независимых клипа: `CAT_BREATH` анимирует только масштаб Chest; `CAT_EAR_TWITCH` — только поворот Ear_R. Поэтому одновременное воспроизведение не смешивает конкурирующие треки. Уменьшение движения поддерживается существующей логикой приложения.

GLB: 173 914 треугольников, 173 157 экспортированных вершин, 2 меша / 5 примитивов, 5 материалов, 3 встроенных изображения, 10 узлов, 37 537 504 байта (35.80 MiB). Внешние декодеры и сетевые ресурсы не нужны. Это заметно тяжелее исходного кота; производительность слабых GPU не подтверждена.

Геометрия меха использует BLEND с alpha 0.32. В SanctuaryScene для неё отключена запись глубины: иначе волоски меньше пикселя дают тёмные точки. Корпус продолжает отбрасывать и принимать обычную тень.

## Проверки

Экспорт проверен в Electron / Three.js: нет ошибок загрузки, оба клипа доступны, движение работает. Проверены атрибуты цвета `COLOR_0` (принудительно выбран CoatColor), отдельные флаги теней меха и отсутствие fallback-кости. Снимки сделаны из экспортированного GLB, а не только из исходного Blender.

Повторный экспорт: выполнить `export()` из `scripts/build_cat.py` через MCP, затем обновить статистику манифеста. Выбор слоя цвета по имени обязателен: автоматический выбор Blender ранее подставлял белый COLOR_0 при сложной цепочке материала. После запекания белый CoatColor на коже корректен: её цвет уже находится в atlas. У меха сохраняется вершинный цвет.

В 1.3.3 выполнена сборка `npm run build:win`: созданы установщик и portable EXE. Четыре теста комнаты проходят. Проверка структуры GLB подтверждает нормализованные веса каждой вершины, конечные координаты/нормали/цвета и отсутствие конфликтующих каналов двух анимаций. SHA256 модели внутри app.asar совпадает с исходным GLB; app.asar внутри portable побайтово соответствует упакованному приложению. По просьбе владельца приложение этой итерацией не запускалось, чтобы не перехватить фокус игры. Рендер Blender использовал два потока CPU и не открывал окно результата.

Корпус 1.3.3 имеет единый переход спины в бок вместо глубокой складки между объёмами, более низкий профиль и асимметрично поджатые лапы. Форма остаётся художественно упрощённой на очень крупном плане; достигнутый фотореализм не заявляется. Снимки комнаты относятся к предыдущей итерации Three.js, актуальный портрет — к Cycles с другим светом.

## Текстура и происхождение

Файлы `textures/short-fur-albedo.png` и `textures/sleeping-tabby-face.png` созданы встроенным ImageGen в режиме генерации специально для этого проекта. Это сгенерированные текстуры, а не фотографии скачанного кота. Геометрия и normal map созданы локально. Цвет мордочки плавно смешан с шерстью и запечён в `textures/cat-coat-atlas.png` средствами Blender. Используемые изображения упакованы в .blend и GLB.

Промпт ImageGen для шерсти:

```
Use case: photorealistic-natural. Asset type: seamless square base-color texture for a physically based 3D cat fur material, not a picture of a cat. Create a very high detail 2048px square orthographic macro scan of dense REAL SHORT CAT FUR, warm ivory/off-white color, single consistent hair growth direction from top to bottom with naturally irregular overlapping soft tapered individual hairs and tiny clumps. The entire frame is flat fur only, edge to edge. Scale: about 8 x 8 centimeters of actual short-haired domestic cat coat. Soft uniformly diffuse illumination, minimal baked shading, no shadows, no bright specular lighting or vignette. The texture must tile seamlessly left-right and top-bottom; no visible pattern repeat, no identifiable large locks. Neutral pale ivory monochrome values suitable for tinting ginger in a 3D shader. It must look like real photographic hair, not fleece, felt, cloth, strands of pasta, plastiline, brushstrokes or a cartoon. No cat body, eyes, face, outline, background, lettering, border, diagram, swatch grid or watermark.
```


Промпт ImageGen для цвета мордочки:

```
Use case: photorealistic-natural. Asset type: frontal color texture projection for an adult ginger tabby CAT FACE on a 3D mesh. A square ultra-sharp photographic orthographic flat scan of the face of a real sleeping adult ginger domestic shorthair cat, EYES CLOSED naturally and relaxed, mouth closed. STRICT CROP: no ears, no neck, no background, no silhouette, no whiskers extending out. The entire square is filled edge-to-edge with the face and fur, forehead at top, cheeks on left/right, chin at bottom. Fine anatomically directed short fur, small mackerel tabby M on forehead, subtle stripes at temples, tawny light orange coat with warm cream whisker pads and chin. Natural narrow closed feline eyelids are centered at horizontal 29% and 71%, on a line 54% down from top. A small natural pink leathery triangular nose centered horizontally at 79% down the frame. Chin at 96% down. Subtle muzzle bulges and natural whisker follicles. Orthographic straight-on direction, bilateral symmetry with tiny natural variation. Broad flat diffuse cross-polarized illumination for a PBR ALBEDO texture, very little shape shadow, no cinematic lighting, no specular glare, no vignette. Fine visible individual hairs, real animal skin detail and facial anatomy. No cartoon, no plush toy, no clay, no 3D render, no illustration, no labels or watermark. This is ONLY a face-filled texture tile.
```


Основания ушей утоплены в голову; вместе с ними перемещены волоски и центры вращения костей. Проверен максимальный поворот Ear_R (кадр 112), щели нет. Исправление включено в seat_ears() сборочного скрипта.
