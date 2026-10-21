# Сторонние компоненты

Исполняемая сборка включает Electron/Chromium и сторонние JavaScript-библиотеки. Их исходные лицензии сохраняются в соответствующих пакетах; лицензии Electron и Chromium поставляются с runtime.

Основные зависимости: React, Three.js, Zustand, sql.js, Zod, fflate и Lucide. Полный состав и версии зафиксированы в `package-lock.json`. Инструменты сборки и тестирования являются зависимостями разработки.

## Звуки

Камин: [Fireplace](https://freesound.org/people/tripjazz/sounds/394754/) — tripjazz, Freesound. Дождь: [Gentle Rain.wav](https://freesound.org/people/shelbyshark/sounds/501243/) — shelbyshark, Freesound. Обе записи используются по [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Приложение выравнивает громкость, смягчает дождь фильтром и сглаживает стык петли.

Настольное радио проигрывает оригинальную lo-fi аранжировку находящейся в общественном достоянии Jingle Bells (James Lord Pierpont, 1857). Фортепианные сэмплы — Simon Dalzell / Ivy Audio и Versilian Studios / Sam Gossner, [VSCO 2 Community Edition](https://versilian-studios.com/vsco-community/), CC0 1.0. Аранжировка и её готовая запись созданы для проекта; исходник рендера находится в `artwork/audio/`. Подробности происхождения и лицензия сэмплов — в `resources/licenses/audio/`.

## Шрифты

Cormorant Garamond, Caveat, Marck Script и Nunito включены локально через Fontsource. Все четыре семейства распространяются по SIL Open Font License 1.1. Копии лицензий находятся в `resources/licenses/`. Сетевая загрузка Google Fonts не используется.

## Данные книг

Поиск метаданных и обложек выполняется через [Open Library](https://openlibrary.org/developers/api). Доступность и точность зависят от конкретного издания. Обложки принадлежат их правообладателям; приложение сохраняет выбранные пользователем изображения для его локальной библиотеки.

Демонстрационные обложки, векторные иллюстрации и иконка приложения созданы для этого проекта. Тексты демонстрационных заметок являются оригинальными; они не выдаются за цитаты из книг.

## 3D-комната

Основа комнаты, кот и праздничный декор созданы Gemini Argon для проекта. В версии 1.2 интерьер доработан в Codex: изменены хвоя, ткань, кант кресла, материалы и runtime-свет. Кот сохранён без изменений. Текущие Blender-исходники находятся в `artwork/codex-v03/source/`. Авторский отчёт о происхождении v01 сохранён в `resources/licenses/room/PROVENANCE.md`; дальнейшие изменения описаны в `resources/licenses/room/V03.md`. Новых сторонних моделей, фототекстур и HDRI для v03 не добавлено. Three.js распространяется по MIT; копия лицензии — `resources/licenses/THREE-LICENSE`.
