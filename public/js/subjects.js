const SUBJECTS = [
  "МатематикаБаза", "МатематикаОГЭ", "МатематикаЕГЭ", "Математика5_8", "Математика9_11",
  "Физика5_8", "ФизикаОГЭ", "ФизикаЕГЭ", "Физика9_11", "Высшая математика", "Олимпиада"
];

let profile = { subjects: [], gender: "Мужской" };

async function loadProfile() {
  try {
    const p = await fetch(`/api/profile/${user.tgId}`).then(r => r.json());
    if (p) profile = p;
  } catch(e) {}

  document.querySelector(`input[name="gender"][value="${profile.gender}"]`).checked = true;
  const list = document.getElementById('subjectsList');
  list.innerHTML = SUBJECTS.map(s => `
    <label class="checkbox-item">
      <input type="checkbox" ${profile.subjects.includes(s) ? 'checked' : ''} onchange="toggleSubject('${s}', this.checked)">
      <span>${s.replace(/_/g, ' ')}</span>
    </label>
  `).join('');
}

function toggleSubject(sub, checked) {
  if (checked && !profile.subjects.includes(sub)) profile.subjects.push(sub);
  if (!checked) profile.subjects = profile.subjects.filter(x => x !== sub);
}

async function saveProfile() {
  profile.gender = document.querySelector('input[name="gender"]:checked').value;
  await fetch(`/api/profile/${user.tgId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  });
  Telegram.WebApp.showAlert("Сохранено!");
}
