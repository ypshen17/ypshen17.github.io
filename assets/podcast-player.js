(() => {
  const grid = document.querySelector('.podcast-grid');
  const iframe = document.getElementById('podcast-soundcloud');
  if (!grid || !iframe || !window.SC || typeof SC.Widget !== 'function') {
    return;
  }

  const widget = SC.Widget(iframe);
  const cards = Array.from(grid.querySelectorAll('.player-card'));
  if (!cards.length) {
    return;
  }

  const indexLookup = new Map();
  const metadata = new Map();
  const playlistUrl = grid.dataset.playlistUrl || iframe.dataset.playlistUrl || '';
  const favorites = new Set();

  const state = {
    ready: false,
    activeIndex: null,
    isPlaying: false,
    sounds: [],
  };

  function formatTime(ms) {
    if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) {
      return '--:--';
    }
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function updateCardStates() {
    cards.forEach((card) => {
      const meta = metadata.get(card);
      if (!meta) return;
      const index = meta.index;
      const isActive = index === state.activeIndex;
      card.classList.toggle('is-active', isActive);
      card.classList.toggle('is-playing', isActive && state.isPlaying);
      if (!isActive) {
        if (meta.progress) meta.progress.style.width = '0%';
        if (meta.current) meta.current.textContent = '0:00';
      }
    });
  }

  function handleToggle(card) {
    if (!state.ready) return;
    const meta = metadata.get(card);
    if (!meta) return;
    const targetIndex = meta.index;
    if (targetIndex === null || Number.isNaN(targetIndex)) return;

  if (state.activeIndex === targetIndex) {
    if (state.isPlaying) {
      widget.pause();
    } else {
      widget.play();
    }
    return;
  }

  state.activeIndex = targetIndex;
  resetActiveCard(targetIndex);
  state.isPlaying = true;
  updateCardStates();
  widget.skip(targetIndex);
  widget.play();
  }

  function handleSeek(offset) {
    if (!state.ready || state.activeIndex === null) return;
    const sound = state.sounds[state.activeIndex];
    const duration = sound ? sound.duration : null;
    widget.getPosition((position) => {
      const next = Math.max(0, position + offset);
      const clamped = typeof duration === 'number' ? Math.min(next, Math.max(duration - 500, 0)) : next;
      widget.seekTo(clamped);
    });
  }

  function toggleFavorite(button) {
    const pressed = button.getAttribute('aria-pressed') === 'true';
    const newState = !pressed;
    button.setAttribute('aria-pressed', newState ? 'true' : 'false');
    const card = button.closest('.player-card');
    const meta = card ? metadata.get(card) : null;
    if (!meta) return;
    if (newState) {
      favorites.add(meta.index);
    } else {
      favorites.delete(meta.index);
    }
    try {
      localStorage.setItem('podcastFavorites', JSON.stringify(Array.from(favorites)));
    } catch (_) {
      /* ignore storage errors */
    }
  }

  function hydrateFavorites() {
    try {
      const saved = JSON.parse(localStorage.getItem('podcastFavorites') || '[]');
      saved.forEach((value) => favorites.add(value));
    } catch (_) {
      favorites.clear();
    }
    cards.forEach((card) => {
      const meta = metadata.get(card);
      if (!meta || !meta.favorite) return;
      const isFav = favorites.has(meta.index);
      meta.favorite.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    });
  }

  function openShare(meta) {
    const url =
      meta.shareOverride ||
      (meta.share && meta.share.getAttribute('href')) ||
      playlistUrl ||
      null;
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  function bindCard(card) {
    const index = Number(card.dataset.trackIndex);
  const meta = {
      index,
      progress: card.querySelector('[data-role="progress-fill"]'),
      current: card.querySelector('[data-role="current-time"]'),
      duration: card.querySelector('[data-role="duration"]'),
      favorite: card.querySelector('[data-action="favorite"]'),
      share: card.querySelector('[data-player-share]'),
      shareOverride: null,
    };
  metadata.set(card, meta);
  indexLookup.set(index, card);
  if (meta.current) meta.current.textContent = '0:00';
  if (meta.progress) meta.progress.style.width = '0%';

  card.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button || !card.contains(button)) {
        return;
      }
      event.preventDefault();
      const action = button.getAttribute('data-action');
      switch (action) {
        case 'toggle':
          handleToggle(card);
          break;
        case 'seek-back':
          handleSeek(-15000);
          break;
        case 'seek-forward':
          handleSeek(15000);
          break;
        case 'favorite':
          toggleFavorite(button);
          break;
        case 'share':
          openShare(meta);
          break;
        default:
          break;
      }
    });
  }

  function applySoundMetadata() {
    widget.getSounds((sounds = []) => {
      state.sounds = sounds;
      sounds.forEach((sound, idx) => {
        const card = indexLookup.get(idx);
        if (!card) return;
        const meta = metadata.get(card);
        if (!meta) return;
        if (meta.duration) {
          meta.duration.textContent = formatTime(sound.duration);
        }
        if (sound && sound.permalink_url) {
          const secret = sound.secret_token || sound.secretToken;
          meta.shareOverride = secret
            ? `${sound.permalink_url}?secret_token=${secret}`
            : sound.permalink_url;
        }
      });
    });
  }

  function resetActiveCard(index) {
    const card = indexLookup.get(index);
    const meta = card ? metadata.get(card) : null;
    if (meta) {
      if (meta.progress) meta.progress.style.width = '0%';
      if (meta.current) meta.current.textContent = '0:00';
    }
  }

  function setupWidgetListeners() {
    widget.bind(SC.Widget.Events.READY, () => {
      state.ready = true;
      applySoundMetadata();
      hydrateFavorites();
    });

    widget.bind(SC.Widget.Events.PLAY, () => {
      widget.getCurrentSoundIndex((idx) => {
        if (typeof idx === 'number') {
          state.activeIndex = idx;
          state.isPlaying = true;
          updateCardStates();
        }
      });
    });

    widget.bind(SC.Widget.Events.PAUSE, () => {
      state.isPlaying = false;
      updateCardStates();
    });

    widget.bind(SC.Widget.Events.FINISH, () => {
      if (state.activeIndex !== null) {
        resetActiveCard(state.activeIndex);
      }
      state.isPlaying = false;
      updateCardStates();
    });

    widget.bind(SC.Widget.Events.PLAY_PROGRESS, (event) => {
      if (state.activeIndex === null) return;
      const card = indexLookup.get(state.activeIndex);
      if (!card) return;
      const meta = metadata.get(card);
      if (!meta) return;
      if (meta.progress) {
        meta.progress.style.width = `${Math.min(Math.max(event.relativePosition, 0), 1) * 100}%`;
      }
      if (meta.current) {
        meta.current.textContent = formatTime(event.currentPosition);
      }
    });
  }

  cards.forEach(bindCard);
  setupWidgetListeners();
})();
