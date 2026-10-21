# Происхождение и лицензионная чистота ассетов (`argon/v01`)

Все 3D-модели, скелет и анимации кота, UV-развёртки, PBR-материалы и текстурные карты в пакете `D:\CodexProjects\OwnLibrary-3D\argon\v01` созданы **с нуля (100% original)** специально для десктопного приложения **«Тихая глава / Cozy Reader’s Sanctuary»**.

## 1. Геометрия и риг (`source/sanctuary-room.blend`, `source/sanctuary-cat.blend`)
- **Источник:** создано процедурно и вручную средствами Blender 5.2 Python API (`bpy`, `bmesh`, `mathutils`) по скрипту `scripts/build_sanctuary_scene.py`.
- **Сторонние 3D-модели:** `0` (не использовались скачанные меши, китбаши или внешние библиотеки).
- **Анимации:** `CAT_BREATH` и `CAT_EAR_TWITCH` созданы процедурно ключевыми кадрами в NLA-треках арматуры `Cat_Armature`.

## 2. Текстуры (`textures/*.png`)
- **Источник:** сгенерированы алгоритмически скриптом `scripts/generate_textures.py` (детерминированный генератор с фиксированными seed-значениями на базе `numpy`).
- **Сторонние текстуры / фотосканы:** `0`.
- **Состав текстурного пакета (25 карт):**
  1. `walnut_wood_{basecolor,roughness,normal}.png` — тёплый тёмный орех книжных шкафов, каминной полки и чайного столика.
  2. `floor_planks_{basecolor,roughness,normal}.png` — дубовые половицы с фасками и вариацией тона.
  3. `fireplace_stone_{basecolor,roughness,normal}.png` — тёплая каменная кладка портала камина.
  4. `terracotta_fabric_{basecolor,roughness,normal}.png` — фактурный терракотовый шенилл/вельвет кресла.
  5. `knit_cream_{basecolor,roughness,normal}.png` — крупная косичковая вязка кремового пледа.
  6. `sanctuary_rug_{basecolor,roughness,normal}.png` — тканый ковёр с геометрическим бордюром.
  7. `wall_plaster_{basecolor,roughness,normal}.png` — тёплая матовая декоративная штукатурка стен.
  8. `mantel_painting_basecolor.png` — авторская иллюстрация вечерней долины в раме над камином.
  9. `cat_ginger_{basecolor,roughness,normal}.png` — рыжий полосатый окрас (ginger tabby) спящего кота.

## 3. Права использования
Пакет полностью принадлежит проекту `OwnLibrary` и может распространяться, модифицироваться и упаковываться в релизные сборки приложения без каких-либо внешних лицензионных ограничений или требований об атрибуции.
