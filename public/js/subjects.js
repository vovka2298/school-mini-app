// public/js/subjects.js
// Полный рабочий файл для вкладки "Предметы"

const SUBJECTS = [
  "МатематикаБаза",
  "МатематикаОГЭ",
  "МатематикаЕГЭ",
  "Математика5_8",
  "Математика9_11",
  "Физика5_8",
  "ФизикаОГЭ",
  "ФизикаЕГЭ",
  "Физика9_11",
  "Высшая математика",
  "Олимпиада",
  "Информатика",
  "Программирование",
  "Химия",
  "Биология",
  "Русский язык",
  "Английский язык",
  "Обществознание",
  "История",
  "География"
  // Добавляй сюда любые предметы — они автоматически появятся
];

let profile = {
  subjects: [],
  gender: "Мужской"
};

// Получаем tgId напрямую из Telegram WebApp (работает в любой вкладке)
function getTgId() {
  try {
    return Telegram.WebApp.initDataUnsafe.user.id.toString();
  } catch (e) {
    console.error("Не удалось получить tgId");
    return null;
  }
}

// Загружаем профиль пользователя
async function loadProfile() {
  const tgId = getTgId();
  if (!tgId) {
    document.getElementById('subjectsList').innerHTML = "<p style='color:#f85149'>Ошибка авторизации Telegram</p>";
    return;
  }

  try {
    const response = await fetch(`/api/profile/${tgId}`);
    if (response.ok) {
      const data = await response.json();
      profile = { ...profile, ...data }; // сохраняем полученное
    }
  } catch (e) {
    console.warn("Не удалось загрузили профиль (возможно, первый вход)", e);
  }

  // Устанавливаем пол
  const genderRadio = document.querySelector(`input[name="gender"][value="${profile.gender}"]`);
  if (genderRadio) genderRadio.checked = true;

  // Рендерим список предметы
  const list = document.getElementById('subjectsList');
  list.innerHTML = SUBJECTS.map(sub => {
    const checked = profile.subjects.includes(sub) ? 'checked' : '';
    const displayName = sub.replace(/_/g, ' ');
    return `
      <label class="checkbox-item">
        <input type="checkbox" ${checked} onchange="toggleSubject('${sub}', this.checked)">
        <span>${displayName}</span>
      </label>
    `;
  }).join('');
}

// Переключение предмета
function toggleSubject(subject, isChecked) {
  if (isChecked && !profile.subjects.includes(subject)) {
    profile.subjects.push(subject);
  } else if (!isChecked) {
    profile.subjects = profile.subjects.filter(s => s !== subject);
  }
}

// Сохранить профиль
async function saveProfile() {
  const tgId = getTgId();
  if (!tgId) {
    Telegram.WebApp.showAlert("Ошибка: не удалось определить ваш ID");
    return;
  }

  // Получаем выбранный пол
  const genderInput = document.querySelector('input[name="gender"]:checked');
  if (genderInput) {
    profile.gender = genderInput.value;
  }

  try {
    const response = await fetch(`/api/profile/${tgId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });

    if (response.ok) {
      Telegram.WebApp.showAlert("Профиль успешно сохранён!");
    } else {
      Telegram.WebApp.showAlert("Ошибка сохранения. Попробуйте позже.");
    }
  } catch (e) {
    console.error("Ошибка при сохранении профиля", e);
    Telegram.WebApp.showAlert("Нет соединения с сервером");
  }
}

// Автозагрузка при открытии вкладки
// Вызывай эту функцию из index.html при клике на вкладку "Предметы"
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('subjectsList')) {
    loadProfile();
  }
});
