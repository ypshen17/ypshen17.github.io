(() => {
  const cards = Array.from(document.querySelectorAll('.podcast-grid .player-card'));
  if (!cards.length || !window.SC || typeof SC.Widget !== 'function') {
    return;
  }

  const favorites = new Set();
  const players = [];
  let activePlayer = null;

  function formatTime(ms) {
    if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) {
      return '--:--';
    }
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function updateFavoriteStorage() {
    try {
      localStorage.setItem('podcastFavorites', JSON.stringify(Array.from(favorites)));
    } catch (_) {
      /* ignore storage errors */
    }
  }

  function syncFavoriteButtons() {
    players.forEach((player) => {
      if (player.meta.favorite) {
        const isFav = favorites.has(player.favoriteKey);
        player.meta.favorite.setAttribute('aria-pressed', isFav ? 'true' : 'false');
      }
    });
  }

  function resetPlayer(player) {
    if (!player) return;
    player.isPlaying = false;
    player.card.classList.remove('is-playing');
    if (player.card !== activePlayer?.card) {
      player.card.classList.remove('is-active');
    }
    if (player.meta.progress) {
      player.meta.progress.style.width = '0%';
    }
    if (player.meta.current) {
      player.meta.current.textContent = '0:00';
    }
  }

  function pauseOthers(except) {
    players.forEach((player) => {
      if (player !== except && player.widget && player.isPlaying) {
        player.widget.pause();
      }
    });
  }

  function seekPlayer(player, offset) {
    if (!player?.widget) return;
    player.widget.getPosition((position) => {
      const duration = typeof player.duration === 'number' ? player.duration : null;
      const next = Math.max(0, position + offset);
      const clamped = duration ? Math.min(next, Math.max(duration - 500, 0)) : next;
      player.widget.seekTo(clamped);
    });
  }

  function toggleFavorite(player) {
    if (!player.meta.favorite) return;
    if (favorites.has(player.favoriteKey)) {
      favorites.delete(player.favoriteKey);
      player.meta.favorite.setAttribute('aria-pressed', 'false');
    } else {
      favorites.add(player.favoriteKey);
      player.meta.favorite.setAttribute('aria-pressed', 'true');
    }
    updateFavoriteStorage();
  }

  function openShare(player) {
    const meta = player.meta;
    const url = player.shareUrl || (meta.share && meta.share.getAttribute('href'));
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  function disableControls(meta) {
    const buttons = meta.buttons || [];
    buttons.forEach((btn) => {
      if (!btn) return;
      if (btn.dataset.action === 'share') {
        return;
      }
      btn.setAttribute('disabled', 'true');
      btn.setAttribute('aria-disabled', 'true');
    });
  }

  function initialiseFavorites() {
    try {
      const saved = JSON.parse(localStorage.getItem('podcastFavorites') || '[]');
      saved.forEach((value) => favorites.add(value));
    } catch (_) {
      favorites.clear();
    }
  }

  function buildPlayer(card, index) {
    const iframe = card.querySelector('.soundcloud-frame');
    const trackId = card.dataset.scId;
    const secret = card.dataset.scSecret;
    const shareAttr = card.dataset.scShare;

    const meta = {
      progress: card.querySelector('[data-role="progress-fill"]'),
      current: card.querySelector('[data-role="current-time"]'),
      duration: card.querySelector('[data-role="duration"]'),
      favorite: card.querySelector('[data-action="favorite"]'),
      share: card.querySelector('[data-player-share]'),
      buttons: Array.from(card.querySelectorAll('[data-action]')),
    };

    if (meta.current) meta.current.textContent = '0:00';
    if (meta.progress) meta.progress.style.width = '0%';

    const favoriteKey = trackId || `card-${index}`;

    if (!trackId || !iframe) {
      card.classList.add('is-unavailable');
      disableControls(meta);
      return {
        card,
        widget: null,
        meta,
        favoriteKey,
        shareUrl: shareAttr || (meta.share && meta.share.href) || null,
        duration: null,
        isPlaying: false,
      };
    }

    const baseUrl = `https://api.soundcloud.com/tracks/${trackId}${secret ? `?secret_token=${secret}` : ''}`;
    const embedSrc = `https://w.soundcloud.com/player/?url=${encodeURIComponent(baseUrl)}&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false&color=%230A1033`;
    iframe.src = embedSrc;

    const widget = SC.Widget(iframe);
    const player = {
      card,
      widget,
      meta,
      favoriteKey,
      shareUrl: shareAttr || (meta.share && meta.share.href) || null,
      duration: null,
      isPlaying: false,
    };

    widget.bind(SC.Widget.Events.READY, () => {
      widget.getDuration((duration) => {
        player.duration = duration;
        if (meta.duration) {
          meta.duration.textContent = formatTime(duration);
        }
      });
    });

    widget.bind(SC.Widget.Events.PLAY, () => {
      pauseOthers(player);
      activePlayer = player;
      player.isPlaying = true;
      card.classList.add('is-active', 'is-playing');
    });

    widget.bind(SC.Widget.Events.PAUSE, () => {
      player.isPlaying = false;
      card.classList.remove('is-playing');
    });

    widget.bind(SC.Widget.Events.FINISH, () => {
      if (activePlayer === player) {
        activePlayer = null;
      }
      resetPlayer(player);
    });

    widget.bind(SC.Widget.Events.PLAY_PROGRESS, (event) => {
      if (meta.progress) {
        const width = Math.min(Math.max(event.relativePosition, 0), 1) * 100;
        meta.progress.style.width = `${width}%`;
      }
      if (meta.current) {
        meta.current.textContent = formatTime(event.currentPosition);
      }
    });

    return player;
  }

  initialiseFavorites();

  cards.forEach((card, index) => {
    const player = buildPlayer(card, index);
    players.push(player);
  });

  syncFavoriteButtons();

  cards.forEach((card, index) => {
    const player = players[index];
    if (!player) return;

    card.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button || !card.contains(button)) return;
      if (button.disabled) return;
      event.preventDefault();

      switch (button.dataset.action) {
        case 'toggle':
          if (!player.widget) return;
          if (player.isPlaying) {
            player.widget.pause();
          } else {
            pauseOthers(player);
            player.widget.play();
          }
          break;
        case 'seek-back':
          seekPlayer(player, -15000);
          break;
        case 'seek-forward':
          seekPlayer(player, 15000);
          break;
        case 'favorite':
          toggleFavorite(player);
          break;
        case 'share':
          openShare(player);
          break;
        default:
          break;
      }
    });
  });
})();
