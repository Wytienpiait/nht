'use strict';

// ===== Navigation and scroll animations =====
const header = document.querySelector('.site-header');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
const navLinks = [...document.querySelectorAll('.nav-link')];
const sections = [...document.querySelectorAll('main section[id]')];

function updateHeader() { header.classList.toggle('scrolled', window.scrollY > 24); }
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

function closeMenu() {
  nav.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Mở menu');
}
menuToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Đóng menu' : 'Mở menu');
});
document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => closeMenu()));
window.addEventListener('resize', () => { if (window.innerWidth > 760) closeMenu(); });

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el));

  const navObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => link.classList.toggle('active', link.hash === `#${entry.target.id}`));
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  sections.forEach(section => navObserver.observe(section));
} else {
  document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('revealed'));
}

// ===== Danh sách bài hát theo khoảnh khắc trong ngày =====
const songData = {
  morning: [
    'Canon in D - Pachelbel',
    'Turkish March - Mozart',
    'What a Wonderful World',
    "Merry go round of life - Joe Hisaishi - Howl's Moving Castle(Piano Version)",
    'Jingle Bells'
  ],
  rainy: [
    'Kiss The Rain - Yiruma',
    'River Flows in You - Yiruma',
    "One Summer's Day - Joe Hisaishi - Spirited Away(Piano Version)",
    'Waltz in A Minor - Chopin',
    'Someone You Loved - Lewis Capaldi',
    'Proud of You - Fiona Fung'
  ],
  sunset: [
    'Perfect - Ed Sheeran',
    'Until I Found You - Stephen Sanchez',
    "Can't Help Falling in Love - Elvis Presley",
    "Mariage d'Amour - Paul de Senneville",
    'I think they call this love - Elliot James Reay',
    'Fly Me To The Moon',
    'Carmen Habanera - Bizet'
  ],
  night: [
    'Moonlight Sonata (1st Movement) - Beethoven',
    'Nocturne in C Sharp Minor - Chopin',
    'Für Elise - Beethoven',
    'Hungarian Sonata - Paul de Senneville',
    'My Heart Will Go On - James Horner & Will Jennings - Titanic(Celine Dion)',
    'Take Five'
  ]
};
const momentInfo = {
  morning: { title: 'Sáng sớm tinh mơ', text: 'Những giai điệu tươi sáng cho một ngày mới bắt đầu' },
  rainy: { title: 'Chiều mưa lặng lẽ', text: 'Cho những buổi chiều có tiếng mưa và chút nhớ nhung' },
  sunset: { title: 'Hoàng hôn dịu dàng', text: 'Những bản nhạc ngọt ngào khi nắng dần tắt' },
  night: { title: 'Đêm khuya một mình', text: 'Khi thế giới ngủ yên, chỉ còn tiếng đàn và mình' }
};
const songModal = document.getElementById('songModal');
const modalPanel = songModal.querySelector('.modal-panel');
const closeModalButton = songModal.querySelector('.modal-close');
const modalTitle = document.getElementById('modalTitle');
const songList = document.getElementById('songList');
let previouslyFocused = null;

function openModal(moment) {
  if (!Object.prototype.hasOwnProperty.call(songData, moment)) return;
  previouslyFocused = document.activeElement;
  modalTitle.textContent = momentInfo[moment].title;
  document.getElementById('modalDesc').textContent = momentInfo[moment].text;
  songList.replaceChildren();
  songData[moment].forEach(song => {
    const item = document.createElement('li');
    item.textContent = song;
    songList.appendChild(item);
  });
  songModal.classList.add('is-open');
  songModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  closeModalButton.focus();
}
function closeModal() {
  if (!songModal.classList.contains('is-open')) return;
  songModal.classList.remove('is-open');
  songModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  previouslyFocused?.focus();
}
// Chỉ mở danh sách bài hát khi nhấn vào thẻ âm nhạc
// Không kích hoạt khi tương tác với Piano 3D

document.querySelectorAll('.genre-card[data-moment]').forEach(btn => {
    btn.addEventListener('click', () => {
        openModal(btn.dataset.moment);
    });
});
closeModalButton.addEventListener('click', closeModal);
songModal.addEventListener('click', event => { if (event.target === songModal) closeModal(); });
document.addEventListener('keydown', event => {
  if (!songModal.classList.contains('is-open')) return;
  if (event.key === 'Escape') closeModal();
  if (event.key === 'Tab') { // keep focus within the dialog
    const focusables = [...modalPanel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')];
    if (!focusables.length) { event.preventDefault(); modalPanel.focus(); return; }
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

// ===== Hộp thư giai điệu =====
// Bước cấu hình: tạo form tại https://formspree.io rồi dán endpoint vào đây
// (dạng 'https://formspree.io/f/abcdwxyz'). Thư sẽ được gửi về email.
const FORM_ENDPOINT = 'https://formspree.io/f/mdegeoar';

const mailboxForm = document.getElementById('mailboxForm');
const mailboxSuccess = document.getElementById('mailboxSuccess');
const mbSubmit = document.getElementById('mb-submit');
const mbStatus = document.getElementById('mb-status');
const mbMessage = document.getElementById('mb-message');
const mbCount = document.getElementById('mb-count');
const mbSuccessText = document.getElementById('mb-success-text');


mbMessage.addEventListener('input', () => { mbCount.textContent = `${mbMessage.value.length} / ${mbMessage.maxLength}`; });

function setFieldError(name, text) {
  const error = mailboxForm.querySelector(`[data-error-for="${name}"]`);
  const field = mailboxForm.elements[name]?.closest('.field');
  if (error) error.textContent = text;
  if (field) field.classList.toggle('has-error', Boolean(text));
}
function setStatus(text, isError = false) {
  mbStatus.textContent = text;
  mbStatus.classList.toggle('is-error', isError);
}
['name', 'message'].forEach(name => mailboxForm.elements[name].addEventListener('input', () => setFieldError(name, '')));

function validateMailbox() {
  const name = mailboxForm.elements.name.value.trim();
  const message = mailboxForm.elements.message.value.trim();
  setFieldError('name', name ? '' : 'Cho mình biết tên bạn nhé.');
  setFieldError('message', message.length >= 10 ? '' : 'Hãy viết vài dòng (ít nhất 10 ký tự) để mình hiểu bạn hơn.');
  if (!name) { mailboxForm.elements.name.focus(); return false; }
  if (message.length < 10) { mailboxForm.elements.message.focus(); return false; }
  return true;
}

mailboxForm.addEventListener('submit', async event => {
  event.preventDefault();
  setStatus('');
  if (!validateMailbox()) return;
  if (mailboxForm.elements._gotcha.value) return; // bot

  if (FORM_ENDPOINT.includes('YOUR_FORM_ID')) {
    setStatus('Hộp thư chưa được kết nối. Hãy dán endpoint Formspree vào FORM_ENDPOINT trong script.js.', true);
    return;
  }

  const label = mbSubmit.querySelector('span');
  mbSubmit.disabled = true;
  label.textContent = 'Đang gửi…';
  try {
    const response = await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(mailboxForm)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const senderName = mailboxForm.elements.name.value.trim();

    mbSuccessText.textContent = `Cảm ơn ${senderName} đã gửi gắm những tâm tư của mình. Mình sẽ lựa chọn một giai điệu phù hợp với câu chuyện của bạn và gửi lại bằng tất cả sự chân thành.`;
    mailboxForm.hidden = true;
    mailboxSuccess.hidden = false;
    mailboxSuccess.focus();
    mailboxForm.reset();
    mbCount.textContent = `0 / ${mbMessage.maxLength}`;
  } catch (error) {
    setStatus('Chưa gửi được thư. Bạn thử lại sau ít phút hoặc nhắn mình qua Facebook / Instagram nhé.', true);
  } finally {
    mbSubmit.disabled = false;
    label.textContent = 'Gửi vào hộp thư';
  }
});

document.getElementById('mb-again').addEventListener('click', () => {
  mailboxSuccess.hidden = true;
  mailboxForm.hidden = false;
  setStatus('');
  mailboxForm.elements.name.focus();
});



/* =========================================
   CINEMATIC PIANO MODE
   ========================================= */

(() => {
  const stage = document.getElementById("piano3d");
  const enterBtn = document.getElementById("cinematicEnter");
  const exitBtn = document.getElementById("cinematicExit");
  const overlay = stage?.querySelector(".cinematic-overlay");

  if (!stage || !enterBtn || !exitBtn || !overlay) {
    return;
  }

  let cinematicEnabled = false;
  let lastFocusedElement = null;

  function updatePianoSize() {
    // Kích hoạt resize handler đã có trong piano3d.js
    window.dispatchEvent(new Event("resize"));
  }

  function enterCinematic() {
    if (cinematicEnabled) return;

    cinematicEnabled = true;
    lastFocusedElement = document.activeElement;

    document.body.classList.add("cinematic-active");
    stage.classList.add("is-cinematic");

    overlay.setAttribute("aria-hidden", "false");
    exitBtn.removeAttribute("tabindex");

    // Đợi trình duyệt áp dụng kích thước mới
    requestAnimationFrame(() => {
      updatePianoSize();
      exitBtn.focus();
    });
  }

  function exitCinematic() {
    if (!cinematicEnabled) return;

    cinematicEnabled = false;

    stage.classList.remove("is-cinematic");
    document.body.classList.remove("cinematic-active");

    overlay.setAttribute("aria-hidden", "true");
    exitBtn.setAttribute("tabindex", "-1");

    requestAnimationFrame(() => {
      updatePianoSize();

      if (lastFocusedElement?.isConnected) {
        lastFocusedElement.focus();
      } else {
        enterBtn.focus();
      }
    });
  }

  enterBtn.addEventListener("click", enterCinematic);
  exitBtn.addEventListener("click", exitCinematic);

  document.addEventListener("keydown", (event) => {
    if (!cinematicEnabled) return;

    if (event.key === "Escape") {
      event.preventDefault();
      exitCinematic();
    }

    // Giữ Tab trong vùng trải nghiệm toàn màn hình
    if (event.key === "Tab") {
      const focusables = [
        exitBtn,
        document.getElementById("pianoCanvas")
      ].filter(Boolean);

      const index = focusables.indexOf(document.activeElement);

      if (event.shiftKey) {
        if (index <= 0) {
          event.preventDefault();
          focusables[focusables.length - 1].focus();
        }
      } else if (index === focusables.length - 1) {
        event.preventDefault();
        focusables[0].focus();
      }
    }
  });

  // Cập nhật lại khi xoay màn hình điện thoại
  window.addEventListener("orientationchange", () => {
    if (cinematicEnabled) {
      setTimeout(updatePianoSize, 200);
    }
  });
})();

// ===== Behind the Melody =====

const melodyStories = document.querySelectorAll(".melody-story");

melodyStories.forEach(story => {
    story.addEventListener("toggle", () => {
        if (!story.open) return;

        melodyStories.forEach(otherStory => {
            if (otherStory !== story) {
                otherStory.open = false;
            }
        });
    });
});


/* =========================================
   VINTAGE LETTER - ANIMATED WRITING PEN
   ========================================= */

(() => {
    const textarea = document.getElementById("mb-message");
    const pen = document.getElementById("writingPen");

    if (!textarea || !pen) return;

    const wrapper = textarea.closest(".letter-writing");

    if (!wrapper) return;

    let writingTimer;

    function updatePenPosition() {
        const style = window.getComputedStyle(textarea);

        // Tạo vùng đo vị trí con trỏ
        const mirror = document.createElement("div");

        mirror.style.position = "absolute";
        mirror.style.visibility = "hidden";
        mirror.style.pointerEvents = "none";
        mirror.style.whiteSpace = "pre-wrap";
        mirror.style.overflowWrap = "break-word";
        mirror.style.boxSizing = "border-box";
        mirror.style.border = "none";

        // Sao chép định dạng từ textarea
        const properties = [
            "fontFamily",
            "fontSize",
            "fontWeight",
            "fontStyle",
            "lineHeight",
            "letterSpacing",
            "textAlign",
            "paddingTop",
            "paddingRight",
            "paddingBottom",
            "paddingLeft",
            "tabSize"
        ];

        properties.forEach(property => {
            mirror.style[property] = style[property];
        });

        mirror.style.width = `${textarea.clientWidth}px`;

        const cursorPosition = textarea.selectionEnd;

        mirror.appendChild(
            document.createTextNode(
                textarea.value.substring(0, cursorPosition)
            )
        );

        // Đánh dấu vị trí con trỏ
        const marker = document.createElement("span");
        marker.textContent = "\u200b";
        mirror.appendChild(marker);

        mirror.appendChild(
            document.createTextNode(
                textarea.value.substring(cursorPosition)
            )
        );

        document.body.appendChild(mirror);

        const markerRect = marker.getBoundingClientRect();
        const mirrorRect = mirror.getBoundingClientRect();
        const textareaRect = textarea.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        const lineHeight = parseFloat(style.lineHeight) || 24;

        const x =
            textareaRect.left - wrapperRect.left +
            textarea.clientLeft +
            markerRect.left - mirrorRect.left -
            textarea.scrollLeft;

        const y =
            textareaRect.top - wrapperRect.top +
            textarea.clientTop +
            markerRect.top - mirrorRect.top +
            lineHeight * 0.75 -
            textarea.scrollTop;

        pen.style.left = `${x}px`;
        pen.style.top = `${y}px`;

        // Ẩn bút nếu con trỏ nằm ngoài vùng nhìn thấy
        pen.classList.toggle(
            "visible",
            document.activeElement === textarea &&
            y >= textarea.offsetTop &&
            y <= textarea.offsetTop + textarea.clientHeight
        );

        mirror.remove();
    }

    function animateWriting() {
        updatePenPosition();

        pen.classList.add("is-writing");

        clearTimeout(writingTimer);

        writingTimer = setTimeout(() => {
            pen.classList.remove("is-writing");
        }, 250);
    }

    textarea.addEventListener("input", animateWriting);

    textarea.addEventListener("focus", updatePenPosition);

    textarea.addEventListener("click", updatePenPosition);

    textarea.addEventListener("keyup", updatePenPosition);

    textarea.addEventListener("select", updatePenPosition);

    textarea.addEventListener("scroll", updatePenPosition);

    textarea.addEventListener("blur", () => {
        clearTimeout(writingTimer);

        pen.classList.remove(
            "visible",
            "is-writing"
        );
    });

    window.addEventListener("resize", () => {
        if (document.activeElement === textarea) {
            updatePenPosition();
        }
    });
})();



/* ==========================================
   THE PIANO SESSIONS - AUDIO & MIDI SYNC
   ========================================== */

(() => {

    const audio = document.getElementById("sessionAudio");
    const playBtn = document.getElementById("sessionPlay");
    const seek = document.getElementById("sessionSeek");
    const volume = document.getElementById("sessionVolume");
    const current = document.getElementById("sessionCurrent");
    const duration = document.getElementById("sessionDuration");
    const status = document.getElementById("sessionStatus");

    const buttons = document.querySelectorAll(".session-track");

    if (!audio || !playBtn) return;

    const tracks = [
        {
            title: "Für Elise",
            src: "audio/fur-elise.mp3",
            notes: "audio/fur-elise.json"
        },
        {
            title: "Turkish March",
            src: "audio/turkish-march.mp3",
            notes: "audio/turkish-march.json"
        }
    ];

    let selectedTrack = 0;
    let noteLoadVersion = 0;
    let notesReady = Promise.resolve(false);
    let playRequested = false;

    audio.volume = 0.6;
    audio.pianoNotes = [];

    function formatTime(seconds) {

        if (!Number.isFinite(seconds)) return "0:00";

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);

        return `${mins}:${String(secs).padStart(2, "0")}`;
    }

    // Tải bài hát và dữ liệu nốt nhạc

    function loadTrack(index) {

        const version = ++noteLoadVersion;

        selectedTrack = index;

        audio.pause();
        audio.pianoNotes = [];

        audio.src = tracks[index].src;
        audio.load();

        seek.value = 0;
        current.textContent = "0:00";
        duration.textContent = "0:00";

        status.textContent = "Đang chuẩn bị tác phẩm...";

        buttons.forEach((btn, i) => {

            btn.classList.toggle("active", i === index);

            btn.setAttribute(
                "aria-pressed",
                String(i === index)
            );
        });

        notesReady = (async () => {

            try {

                const response = await fetch(
                    tracks[index].notes
                );

                if (!response.ok) {
                    throw new Error("Không tải được JSON");
                }

                const notes = await response.json();

                if (version !== noteLoadVersion) return false;

                if (!Array.isArray(notes)) {
                    throw new Error("Dữ liệu nốt không hợp lệ");
                }

                audio.pianoNotes = notes;

                status.textContent = "";

                return true;

            } catch (error) {

                if (version === noteLoadVersion) {
                    status.textContent =
                        "Không tải được dữ liệu phím đàn.";
                }

                console.error(error);

                return false;
            }

        })();
    }

    // Phát nhạc

    async function playMusic() {

        const version = noteLoadVersion;
        playRequested = true;

        // Gọi play trực tiếp từ sự kiện click
        // để hỗ trợ chính sách phát nhạc của trình duyệt.

        try {

            await audio.play();

            const ready = await notesReady;

            if (version !== noteLoadVersion) return;

            if (!ready) {
                audio.pause();
                playRequested = false;
                return;
            }

            if (!playRequested) return;

            status.textContent = "Đang biểu diễn: " +
                                 tracks[selectedTrack].title;

        } catch (error) {

            if (version !== noteLoadVersion) return;

            playRequested = false;

            status.textContent =
                "Không thể phát nhạc. Hãy kiểm tra file MP3.";
        }
    }

    // Cập nhật biểu tượng Play/Pause

    function updatePlayButton() {

        playBtn.innerHTML = audio.paused
            ? '<i class="fa-solid fa-play"></i>'
            : '<i class="fa-solid fa-pause"></i>';

        playBtn.setAttribute(
            "aria-label",
            audio.paused ? "Phát nhạc" : "Tạm dừng"
        );
    }

    // Chọn bài hát

    buttons.forEach(btn => {

        btn.addEventListener("click", () => {

            const index = Number(btn.dataset.track);

            if (index !== selectedTrack) {
                loadTrack(index);
            }

            playMusic();
        });

    });

    // Nút Play/Pause

    playBtn.addEventListener("click", () => {

        if (audio.paused) {

            playMusic();

        } else {

            playRequested = false;
            audio.pause();

            status.textContent = "Đã tạm dừng";
        }
    });

    audio.addEventListener("play", updatePlayButton);
    audio.addEventListener("pause", updatePlayButton);

    // Thanh tiến trình phát nhạc

    audio.addEventListener("timeupdate", () => {

        if (audio.duration > 0) {

            seek.value =
                (audio.currentTime / audio.duration) * 100;
        }

        current.textContent = formatTime(audio.currentTime);
    });

    audio.addEventListener("loadedmetadata", () => {

        duration.textContent = formatTime(audio.duration);
    });

    // Tua nhạc

    seek.addEventListener("input", () => {

        if (Number.isFinite(audio.duration)) {

            audio.currentTime =
                (Number(seek.value) / 100) * audio.duration;
        }

    });

    // Âm lượng

    volume.addEventListener("input", () => {

        audio.volume = Number(volume.value);

    });

    // Kết thúc bài hát

    audio.addEventListener("ended", () => {

        playRequested = false;

        updatePlayButton();

        status.textContent = "Đã kết thúc tác phẩm.";

    });

    // Lỗi tải file âm thanh

    audio.addEventListener("error", () => {

        playRequested = false;

        status.textContent = "Không tìm thấy file nhạc.";

        updatePlayButton();
    });

    // Không phát video và nhạc cùng lúc

    document.querySelectorAll("video").forEach(video => {

        video.addEventListener("play", () => {

            playRequested = false;
            audio.pause();

        });

    });

    audio.addEventListener("play", () => {

        document.querySelectorAll("video").forEach(video => {

            video.pause();

        });

    });

    // Khởi tạo bài Für Elise, không tự động phát

    loadTrack(0);

})();
