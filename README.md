<div align="center">

# 📖 Тихая глава

**Уютная личная библиотека и читательский дневник с 3D-комнатой у камина**

_Cozy Reader’s Sanctuary · Windows · работает полностью офлайн_

![Windows](https://img.shields.io/badge/Windows-x64-6b7a5e?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-455260?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-5b627c?style=flat-square&logo=react&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-946a58?style=flat-square&logo=threedotjs&logoColor=white)
![Offline](https://img.shields.io/badge/данные-только_локально-8c5360?style=flat-square)

<br>

<img src="docs/screenshots/room.png" alt="3D-комната историй" width="100%">

</div>

<br>

> _Самые тихие вечера оставляют самые тёплые истории._

## ✨ Что внутри

- 🕯 **3D-комната** — камин, ёлка, спящий кот и книжные шкафы, где стоят ваши книги. Наведите на корешок — книга выдвинется, кликните — откроется её дневник.
- 📚 **Библиотека** — обложки, оценки, поиск изданий в Open Library и список «Хочу прочитать».
- ✂️ **Дневник-скрапбук** — двухстраничные развороты: заметки, цитаты, фото, наклейки, васи-скотч и рисование.
- 📈 **Спокойный прогресс** — цель на месяц и статистика без гонки за цифрами.
- 💌 **Карточки итогов** — красивые открытки 1080×1920 для телефона и соцсетей.
- 🌧 **Звуки уюта** — дождь, треск камина и тихое радио; светлая, тёмная и праздничная темы.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/library.png" alt="Библиотека"></td>
    <td width="50%"><img src="docs/screenshots/journal-collage.png" alt="Дневник-скрапбук"></td>
  </tr>
  <tr>
    <td align="center"><sub>Библиотека</sub></td>
    <td align="center"><sub>Дневник-скрапбук</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/story.png" alt="Карточка итогов чтения"></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><sub>Итоги чтения</sub></td>
  </tr>
</table>

## 🚀 Установка

Откройте последнюю успешную сборку в [**GitHub Actions**](../../actions/workflows/windows.yml), скачайте артефакт `Sanctuary-Windows-x64` и запустите `.exe` — больше ничего устанавливать не нужно.

<details>
<summary><b>Сборка из исходников</b></summary>

<br>

Нужны Windows 10/11 и Node.js 20+.

```powershell
git clone https://github.com/GL1NoMe5/OwnLibrary.git
cd OwnLibrary
npm ci
npm run dev        # запуск в режиме разработки
npm run build:win  # сборка установщика в dist/
```

</details>

## 🔒 Ваши данные

Всё хранится только на вашем компьютере — в `%APPDATA%\Cozy Reader's Sanctuary`. Никаких аккаунтов и облаков. Резервную копию библиотеки можно сохранить в один `.zip` прямо из настроек.

<br>

<div align="center">

<sub>Electron · React · TypeScript · Three.js · SQLite &nbsp;·&nbsp; [Сторонние компоненты](THIRD_PARTY_NOTICES.md)</sub>

<br><br>

_Место, где книги находят свой дом, а мысли остаются между строк_ 🌿

</div>
