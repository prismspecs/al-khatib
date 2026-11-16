import { t } from '../i18n.js';
import { sanitizeEntryHtml } from './sanitize.js';
import { showLayer, hideLayer, isLayerOpen } from './layer.js';

/**
 * About View (PLAN.md §2.4 E & §6).
 * Presents Post 550's archival statement followed by the collective statement,
 * contributors, guests, project leads, funder, and contacts in editorial layout.
 */

const WORKSHOP_INTROS = {
    de: "Das 2017 gegründete Kollektiv Wiese (Wie es ist) مرج ist eine mehrsprachige Schreibwerkstatt, in der Literatur und Poesie übersetzt, besprochen, weitergeschrieben werden. Auf der Wiese werden verschiedene Sprachen gesprochen, vorrangig übersetzt wird momentan zwischen syrischem Arabisch und Deutsch. Die Gruppe setzt sich zusammen aus Schriftsteller*innen, Übersetzer*innen und Literaturwissenschaftler*innen verschiedenster Herkunft und ist offen für alle. Wir sind immer offen für neue Mitglieder, die mitarbeiten, eigene Texte mitbringen oder Übersetzungen anregen wollen. Seit 2021 widmet sich das Kollektiv mit den Projekten „Der unsichtbare Prozess“ und „Al-Khatib-Glossar“ Leseperformances und einer literarischen Übersetzungskritik auf Basis des Al-Khatib-Verfahrens in Koblenz. Die Wiese trifft sich immer mittwochs gegen Abend im Theater X, Berlin-Moabit und lädt unregelmäßig zu öffentlichen Veranstaltungen in die Lettrétage und anderswo.",
    en: "Founded in 2017, the collective Wiese (as it is) مرج is a multilingual writing workshop. Wiese is about literature, poetology, and the autonomy of linguistic beauty — but also about claims to social space and politics. Wiese speaks different languages, currently the focus is on translations between Syrian Arabic and German. The group is made up of writers, translators and literary scholars from various backgrounds and is open to all. Since 2021, the collective has been dedicated to reading performances and a literary translation critique based on the Al-Khatib trial in Koblenz with the projects “The Invisible Process” and “Al-Khatib Glossary”. Wiese meets every Wednesday evening at Theater X, Berlin-Moabit and irregularly holds public events at Lettrétage and elsewhere.",
    ar: "تقوم مجموعة مرج الأدبية بترجمة الأدب والشعر منذ سنوات حيث تندمج الاعتبارات الشعرية واللغوية والسياسية بعضها ببعض. تجتمع المجموعة بانتظام في Lettrétage منذ خريف 2021.حيث تعرض نتائج من مشروع“المحاكمة الغير مرئية“/محاكمة الخطيب في كوبلنز يمكن لأي شخص يرغب في المشاركة وطرح نصوصه للمناقشة (باللغة العربية/الإنجليزية/ الألمانية) التواصل عبر: wiesewieesist@gmx.de"
};

const COLLECTIVE_STATEMENTS = {
    de: {
        paragraphs: [
            "Das Übersetzer*innenkollektiv Wiese (Wie es ist) / مرج präsentiert seine Arbeit der letzten zwei Jahre: das AL-KHATIB-GLOSSAR. Das Glossar bezieht sich auf das Al-Khatib-Verfahren, das jüngst in Koblenz unter dem »Weltrechtsprinzip« zwei Geheimdienstler des syrischen Assad-Regimes vor Gericht gestellt hat. Es bezieht sich auf ein Verfahren, das als Text so nicht existiert, jedenfalls nicht vollständig und nicht im Wortlaut dokumentiert wurde. Auch bezieht es sich nicht nur auf dieses Verfahren, sondern auf das Gewaltgeschehen, für das der Name Al-Khatib mittlerweile steht. Die repressiven, todbringenden Praktiken, die Al-Khatib ausmachen, sind wiederum in dem weiteren Kontext der Anstrengungen der syrischen Revolution zu sehen, die in der Geheimdienstabteilung 251 (Al-Khatib-Abteilung) zum Schweigen gebracht werden sollen. All das – der Al-Khatib-Komplex – ist der sogenannte »Text«, dem sich die Glossararbeit der Wiese widmet.",
            "Ein politischer Konflikt, dessen Schauplatz u.a. die Sprache ist. Welche Wörter bleiben in Koblenz unübersetzt, unübersetzbar? Lassen sich diese als Fragmente einer Sprache der syrischen Revolution (re)konstruieren? Was, wenn Redewendungen zu Drohungen werden? Kann Sprache eine Form der Folter sein? Wo überblenden sich deutsches Gerichtsverfahren und Straßenszenen aus Damaskus? Wie weit reichen historische Verstrickungen zwischen syrischen und europäischen Geheimdiensten? Welche Echos, Bezüge, Widersprüche stellen sich zwischen unseren arabischen, deutschen und zwischensprachigen Mitschriften ein, die stets brüchig und lückenhaft sind?",
            "Das Glossar experimentiert mehrsprachig und multimedial mit diesen porösen, zaghaften und unvollständigen Spuren, löst Wörter und Begriffe aus einer bestimmten juristischen, politischen Ordnung – und Satzstellung – heraus, befragt sie anders, nicht zuletzt nach ihrem utopischen Aspekt. Dabei geht es oft um ein Eingreifen literarischer Formen in soziale Prozesse, ein Durcharbeiten von Worten, die gewaltbehaftet sind.",
            "Die Auseinandersetzung mit den revolutionären Geschehnissen in Syrien und deren Folgen ist ein offener und nicht abgeschlossener Prozess, der vielerorts und vielgestaltig sichtbar wird. Das Glossar ist einer dieser Orte, konzipiert als Versuch, neue, kritische Öffentlichkeiten rund um den Al-Khatib-Komplex zu generieren. Wider einer wiederholten Unsichtbarmachung von Betroffenen, versteht sich das Glossar u.a. als eine Stellungnahme entgegen der folgenschweren Aufzeichnungsverweigerung des Koblenzer Gerichts. Wir geben der Form dieser politischen Arbeit den Namen Glossar, da das Glossar auf besondere Art die künstlerische Dokumentation und Bearbeitung eines Wissens erlaubt, das ein vielstimmiges Wissen ist und ein von vielen unterschiedlich verkörpertes."
        ],
        contributors: "Galal Alahmady, Maru Younes, Sandra Burkhardt, Carsten Jenss, Marlene Feger, Christian Filips, Kenan Khadaj, Aniol Kirberg, Miriam Rainer, Raguel Roumer, Pasqual Solaß",
        guests: "Nauras Ali, Ali Jazo, Luna Watfa, Hannah El-Hitami",
        leads: "Maru Younes, Miriam Rainer",
        funder: "Das Projekt wird gefördert vom Deutschen Übersetzerfonds."
    },
    en: {
        paragraphs: [
            "Al Khatib: a residential neighborhood in Damascus: a street: an intelligence department. An intelligence branch in a street in a residential neighborhood in Damascus. A residential neighborhood: an intelligence branch. A street: an intelligence branch. Al Khatib.",
            "The literary collective Wiese (As it is) / مرج presents its work of the last two years: the AL-KHATIB-GLOSSARY. The glossary refers to the Al-Khatib trial, which recently tried two intelligence officers of the Syrian Assad regime in Koblenz under the principle of “universal jurisdiction\". It refers to a trial that does not exist as a text in this way, at least not in any comprehensive and verbatim form of documentation. Nor does it refer only to this trial, but to the violent events for which the name Al-Khatib has come to stand. The repressive, death-dealing practices that constitute Al-Khatib are, in turn, to be seen in the broader context of the Syrian revolution’s efforts that the intelligence division 251 (Al-Khatib branch) means to silence. All of this – the al-Khatib complex – is the so-called “text\" that makes up the point of departure for the Wiese's glossary.",
            "A political conflict that takes place, among other places, in language. Which words remain untranslated, untranslatable in Koblenz? Can these be (re)constructed as fragments of a language of the Syrian revolution? What if idioms become threats? Can language be a form of torture? Where do German court proceedings and street scenes from Damascus overlap? To what extent can we trace historical entanglements between Syrian and European intelligence services? What echoes, relations, contradictions emerge among our Arabic, German and interlingual protocols, which remain approximate and incomplete?",
            "The glossary experiments via multilingual and multimedia means with these porous, tentative and incomplete traces, detaches words and terms from a certain legal, political order – and word order –, works through them differently, not least in search for their utopian aspect. This labor often involves an intervention of literary forms into social processes, a working through of words that are fraught with violence.",
            "The confrontation with the revolutionary events in Syria and their consequences is an open and unfinished process that is visible in many places and in many forms. The Glossary is one of these places, conceived as an attempt to generate new, critical public spheres in relation to the Al-Khatib complex. Against a second invisibilization of witnesses, survivors and otherwise afflicted, the glossary understands itself, among other things, as a statement against the consequential refusal of the Koblenz court to record the proceedings. We give the name Glossary to the form of this political work, because the glossary in particular allows for artistic documentation and response to a knowing that we perceive as polyphonic and as variously embodied."
        ],
        contributors: "Galal Alahmady, Maru Younes, Sandra Burkhardt, Carsten Jenss, Marlene Feger, Christian Filips, Kenan Khadaj, Aniol Kirberg, Miriam Rainer, Raguel Roumer, Pasqual Solaß",
        guests: "Nauras Ali, Ali Jazo, Luna Watfa, Hannah El-Hitami",
        leads: "Maru Younes, Miriam Rainer",
        funder: "The project is supported by Deutscher Übersetzerfonds."
    },
    ar: {
        paragraphs: [
            "فرع مخابرات في شارع في منطقة سكنية في دمشق . منطقة سكنية: فرع مخابرات. شارع: فرع مخابرات . الخطيب.",
            "مجموعة الترجمة مرج تعرض عملها خلال السنتين الماضيتين: معجم الخطيب. يستند المعجم على محاكمة الخطيب، التي جلبت مؤخراً اثنين من عملاء المخابرات السرية التابعة لنظام الأسد السوري إلى المحكمة في كوبلنز تحت مبدأ الولاية القضائية العالمية. يشير المعجم إلى محاكمة غير موجودة كنص، على الأقل ليس بشكل كامل وغير موثقة حرفياً. كما أنه لايشير إلى المحاكمة فحسب، بل إلى الأحداث العنيفة التي يطلق عليها اسم الخطيب الآن. مرة أخرى، يجب النظر إلى الممارسات القمعية والقاتلة التي تميز الخطيب في السياق الأوسع لجهود الثورة السورية التي يتم إسكاتها في فرع المخابرات 251 (فرع الخطيب). كل هذا هو ما يُعرف ب&lt;النص&gt;، الذي كُرّس له عمل مجموعة مرج في هذا المعجم.",
            "صراع سياسي مسرحه ـ من بين أمور أخرى ـ اللغة. ماهي الكلمات التي ظلت غير مترجمة وغير قابلة للترجمة في كوبلنز؟ هل يمكن إعادة بنائها على هيئة أجزاء من لغة الثورة السورية؟ ماذا لو أصبحت التعابير الاصطلاحية في اللغة تهديداً؟ هل يمكن أن تصبح اللغة شكلاًمن أشكال التعذيب؟ أين تتداخل إجراءات المحكمة الألمانية ومشاهد الشوارع في دمشق؟ إلى أي مدى تصل التشابكات التاريخية بين المخابرات السرية السورية والأوروبية؟ ما هي الأصداء الموجودة بين ملاحظاتنا العربية والألمانية والمتعددة اللغات. والتي دائماً ما تكون مجرد تقديرات تقريبية ل (غير) المسموع (المسموح ) باختفائه.",
            "المعجم هو تجارب مع هذه الآثار الهشة والخجولة غير المكتملة في عدة لغات و باستخدام عدة وسائط، هو استخراج لكلمات ومصطلحات من نظام قانوني وسياسي معين ـ وترتيب جمل ـ يشكك فيها بشكل مختلف بحثاً عن الجانب اليوتوبي المثالي. يْفهم المعجم من بين أمور أخرى على أنه بيان ضد رفض محكمة كوبلنز توثيق المحاكمة والذي له عواقب وخيمة."
        ],
        contributors: "جلال الأحمدي، مرو يونس المقبل، نورس علي، ساندرا بوركاردت، علي جازو، كارستن ينس، مارلينه فيغر، كريستيان فيليبس، كنان خداج، أنيول كيربيرغ، ميريام راينر، راغيل رومير، باسكال سولاس",
        guests: "",
        leads: "",
        funder: ""
    }
};

export function createAbout({ container, router, store }) {
    const el = document.createElement('div');
    el.id = 'akg-about-panel';
    el.className = 'akg-panel about-panel';
    el.setAttribute('hidden', '');
    el.setAttribute('inert', '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'About Al-Khatib Glossar');

    el.innerHTML = `
        <header class="panel-header">
            <div class="panel-header-left">
                <a href="#/map" class="panel-wordmark">Al-Khatib</a>
                <div class="about-meta-left">
                    <span class="about-type-badge" data-t="aboutTitle"></span>
                    <div class="akg-chip-group lang-switch-group">
                        <button class="akg-chip about-lang-chip" data-lang="de">DE</button>
                        <button class="akg-chip about-lang-chip" data-lang="en">EN</button>
                        <button class="akg-chip about-lang-chip" data-lang="ar">عربي</button>
                    </div>
                </div>
            </div>
            <div class="panel-header-right">
                <button type="button" class="akg-chip close-btn" id="about-close-btn" title="Close About (Esc)">
                    <span data-t="close"></span>
                    <span class="kbd-hint">[Esc]</span>
                </button>
            </div>
        </header>

        <div class="reading-progress">
            <div class="reading-progress-fill" id="about-progress-fill"></div>
        </div>

        <div class="panel-scroll" id="about-panel-scroll">
            <div class="about-reading-container" id="about-content-body">
                <!-- Injected content -->
            </div>
        </div>
    `;

    container.appendChild(el);

    const progressBar = el.querySelector('#about-progress-fill');
    const panelScroll = el.querySelector('#about-panel-scroll');
    const contentBody = el.querySelector('#about-content-body');
    const closeBtn = el.querySelector('#about-close-btn');
    const wordmarkLink = el.querySelector('.panel-wordmark');

    let currentAboutData = null;
    let isOpen = false;

    // Track scroll reading progress
    panelScroll.addEventListener('scroll', () => {
        const scrollTop = panelScroll.scrollTop;
        const scrollHeight = panelScroll.scrollHeight - panelScroll.clientHeight;
        const pct = scrollHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100)) : 0;
        if (progressBar) progressBar.style.width = `${pct}%`;
    }, { passive: true });

    const render = () => {
        const lang = store.get().lang;
        const isRTL = lang === 'ar';
        el.setAttribute('dir', isRTL ? 'rtl' : 'ltr');

        // Update static translations
        el.querySelectorAll('[data-t]').forEach(node => {
            const key = node.getAttribute('data-t');
            node.textContent = t(lang, key);
        });

        // Update language chips
        el.querySelectorAll('.about-lang-chip').forEach(btn => {
            btn.classList.toggle('is-active', btn.getAttribute('data-lang') === lang);
        });

        const displayTitleText = lang === 'ar' ? 'معجم الخطيب' : 'Al-Khatib-Glossar';
        const subtitleText = t(lang, 'aboutSubtitle');

        // 1. Workshop description
        const workshopText = WORKSHOP_INTROS[lang] || WORKSHOP_INTROS.de;

        // 2. Collective statement
        const statementData = COLLECTIVE_STATEMENTS[lang] || COLLECTIVE_STATEMENTS.de;
        const paragraphsHtml = statementData.paragraphs
            .map(p => `<p class="statement-para">${p}</p>`)
            .join('');

        contentBody.innerHTML = `
            <div class="about-hero">
                <h1 class="about-display-title">${displayTitleText}</h1>
                <p class="about-subtitle">${subtitleText}</p>
            </div>

            <div class="about-lead">
                <p>${workshopText}</p>
            </div>

            <div class="about-section-header">
                <span class="about-section-label">${t(lang, 'statementHeading')}</span>
                <span class="about-section-line"></span>
            </div>

            <div class="about-statement">
                ${paragraphsHtml}
            </div>

            <div class="about-section-header">
                <span class="about-section-label">${t(lang, 'contributors')}</span>
                <span class="about-section-line"></span>
            </div>

            <dl class="about-credits-grid">
                ${statementData.contributors ? `
                    <div class="about-credit-card">
                        <dt class="credit-role">${t(lang, 'contributors')}</dt>
                        <dd class="credit-people">${statementData.contributors}</dd>
                    </div>` : ''}
                ${statementData.guests ? `
                    <div class="about-credit-card">
                        <dt class="credit-role">${t(lang, 'guests')}</dt>
                        <dd class="credit-people">${statementData.guests}</dd>
                    </div>` : ''}
                ${statementData.leads ? `
                    <div class="about-credit-card">
                        <dt class="credit-role">${t(lang, 'projectLeads')}</dt>
                        <dd class="credit-people">${statementData.leads}</dd>
                    </div>` : ''}
            </dl>

            ${statementData.funder ? `
                <div class="about-funder-card">
                    <span class="credit-role">${t(lang, 'fundingHeading')}</span>
                    <p class="funder-text">${statementData.funder}</p>
                </div>` : ''}

            <div class="about-contact-card">
                <span class="credit-role">${t(lang, 'contact')}</span>
                <div class="contact-links">
                    <a href="mailto:wiesewieesist@gmx.de" class="about-link" target="_blank" rel="noopener">
                        <span class="about-link-icon">✉</span>
                        <span>wiesewieesist@gmx.de</span>
                    </a>
                    <a href="https://instagram.com/wiesewieesist" class="about-link" target="_blank" rel="noopener">
                        <span class="about-link-icon">↗</span>
                        <span>@wiesewieesist</span>
                    </a>
                </div>
            </div>
        `;
    };

    const show = (aboutData) => {
        if (aboutData) currentAboutData = aboutData;
        isOpen = true;
        document.body.classList.add('is-about-open');
        render();
        panelScroll.scrollTop = 0;
        if (progressBar) progressBar.style.width = '0%';
        showLayer(el);
    };

    const hide = (navigate = false, immediate = false) => {
        if (!isOpen && el.hasAttribute('hidden')) return;
        isOpen = false;
        document.body.classList.remove('is-about-open');
        hideLayer(el, { immediate });

        if (navigate && router && store.get().view === 'about') {
            router.navigate('#/map');
        }
    };

    // Close buttons & wordmark navigation
    closeBtn.addEventListener('click', () => hide(true));
    if (wordmarkLink) {
        wordmarkLink.addEventListener('click', (e) => {
            e.preventDefault();
            hide(true);
        });
    }

    // Language switcher
    el.querySelectorAll('.about-lang-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            store.setLang(btn.getAttribute('data-lang'));
        });
    });

    // Keyboard shortcuts (Esc closes)
    const onKeyDown = (e) => {
        if (!isOpen) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            hide(true);
        }
    };
    window.addEventListener('keydown', onKeyDown);

    // Subscribe to language changes
    store.subscribe((state, key) => {
        if (isOpen && key === 'lang') {
            render();
        }
    });

    return {
        el,
        show,
        hide,
        isOpen: () => isLayerOpen(el),
        setData: (data) => {
            currentAboutData = data;
            if (isOpen) render();
        },
        cleanup: () => {
            document.body.classList.remove('is-about-open');
            window.removeEventListener('keydown', onKeyDown);
            if (el.parentElement) el.parentElement.removeChild(el);
        }
    };
}
