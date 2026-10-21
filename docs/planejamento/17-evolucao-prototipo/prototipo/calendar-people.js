/* Participantes ilustrativos do calendário. Não lê contatos nem altera eventos. */
(() => {
  'use strict';
  const A = window.App;
  const own = (value, property) => Object.prototype.hasOwnProperty.call(value, property);
  const people = {
    ana: {id:'demo-ana', name:'Ana Lima', avatar:'assets/avatars/ana.png'},
    rafael: {id:'demo-rafael', name:'Rafael Costa', avatar:'assets/avatars/rafael.png'},
    marina: {id:'demo-marina', name:'Marina Alves', avatar:'assets/avatars/marina.png'}
  };
  const examples = {
    e1: {title:'Revisão do Segundo Cérebro', people:['ana','rafael','marina']},
    e6: {title:'Conversa sobre o produto', people:['ana','rafael']},
    e10: {title:'Apresentação do projeto', people:['ana','rafael','marina']},
    e13: {title:'Grupo de leitura', people:['ana','marina']}
  };
  function isExample(event) {
    return Boolean(event && !own(event, 'participants') && own(examples, event.id) && examples[event.id].title === event.title);
  }
  function safeAvatar(value) {
    if (typeof value !== 'string') return '';
    return /^assets\/avatars\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.png$/.test(value) ||
      /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
  }
  function list(event) {
    if (!event || typeof event !== 'object') return [];
    const raw = own(event, 'participants') ? event.participants :
      isExample(event) ? examples[event.id].people.map(id => people[id]) : [];
    if (!Array.isArray(raw)) return [];
    return raw.filter(person => person && typeof person === 'object' && typeof person.name === 'string' && person.name.trim())
      .map((person, index) => ({
        id:typeof person.id === 'string' && person.id.trim() ? person.id.trim() : `participant-${index + 1}`,
        name:person.name.trim().replace(/\s+/g, ' '),
        avatar:safeAvatar(person.avatar)
      }));
  }
  function initials(name) {
    const parts = name.split(/\s+/);
    return (Array.from(parts[0])[0] + (parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : '')).toLocaleUpperCase('pt-BR');
  }
  function avatar(person, size = 32) {
    return `<span class="cal-people-avatar" aria-hidden="true"><span class="cal-people-initials">${A.esc(initials(person.name))}</span>${person.avatar ? `<img data-cal-avatar src="${A.esc(person.avatar)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">` : ''}</span>`;
  }
  function stack(event) {
    const participants = list(event);
    if (participants.length < 2) return '';
    const label = `${participants.length} participantes: ${participants.map(person => person.name).join(', ')}`;
    return `<span class="cal-people-stack" role="img" aria-label="${A.esc(label)}">${participants.slice(0, 4).map(person => avatar(person)).join('')}${participants.length > 4 ? `<span class="cal-people-more" aria-hidden="true">+${participants.length - 4}</span>` : ''}</span>`;
  }
  function details(event) {
    const participants = list(event);
    if (!participants.length) return '';
    return `<section class="cal-people-details"><h3>Participantes <span class="cal-people-count">${participants.length}</span></h3><ul class="cal-people-list">${participants.map(person => `<li>${avatar(person, 40)}<span class="cal-people-name">${A.esc(person.name)}</span></li>`).join('')}</ul>${isExample(event) ? '<p class="cal-people-note">Participantes fictícios para demonstrar uma reunião em grupo.</p>' : ''}</section>`;
  }
  document.addEventListener('error', event => {
    const image = event.target;
    if (image && typeof image.matches === 'function' && image.matches('img[data-cal-avatar]')) image.hidden = true;
  }, true);
  A.calendarPeople = {list, stack, details};
})();
