// public/js/subjects.js — 100% рабочая

const SUBJECTS = [
  "МатематикаБаза","МатематикаОГЭ","МатематикаЕГЭ","Математика5_8","Математика9_11",
  "Физика5_8","ФизикаОГЭ","ФизикаЕГЭ","Физика9_11","Высшая математика","Олимпиада",
  "Информатика","Программирование","Химия","Биология","Русский язык",
  "Английский язык","Обществознание","История","География"
];

let profile = { subjects: [], gender: "Мужской" };

function getTgId() {
  try {
    return Telegram.WebApp.initDataUnsafe?.user?.id?.toString() || null;
  } catch { return null; }
}

function getHeaders() {
  return { 'x-telegram-webapp-init-data': Telegram.WebApp.initData || '' };
}

async function loadProfile() {
  const tgId = getTgId();
  if (!tgId) return;

  try {
    const r = await fetch(`/api/profile/${tgId}`, { headers: getHeaders() });
    if (r.ok) {
      const d = await r.json();
      profile.subjects = Array.isArray(d.subjects) ? d.subjects : [];
      profile.gender = ["Мужской","Женский"].includes(d.gender) ? d.gender : "Мужской";
    }
  } catch (e) { console.warn(e); }

  document.querySelector(`input[name="gender"][value="${profile.gender}"]`)?.setAttribute('checked', true);

  const list = document.getElementById('subjectsList');
  if (list) {
    list.innerHTML = SUBJECTS.map(s => {
      const ch = profile.subjects.includes(s) ? 'checked' : '';
      return `<label class="checkbox-item">
        <input type="checkbox" ${ch} onchange="toggleSubject('${s}', this.checked)">
        <span>${s.replace(/_/g, ' ')}</span>
      </label>`;
    }).join('');
  }
}

function toggleSubject(sub, checked) {
  if (checked && !profile.subjects.includes(sub)) profile.subjects.push(sub);
  if (!checked) profile.subjects = profile.subjects.filter(x => x !== sub);
}

async function saveProfile() {
  const tgId = getTgId();
  if (!tgId) return Telegram.WebApp.showAlert("Ошибка авторизации");

  const g = document.querySelector('input[name="gender"]:checked');
  if (g) profile.gender = g.value;

  try {
    const r = await fetch(`/api/profile/${tgId}`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
    r.ok ? Telegram.WebApp.showAlert("Сохранено!") : Telegram.WebApp.showAlert("Ошибка");
  } catch {
    Telegram.WebApp.showAlert("Нет интернета");
  }
}
