
import { Language } from '../types';
import { analyzeCargoCode } from './cargoReference';

type TranslationKeys = string;

const dictionary: Record<string, Record<Language, string>> = {
  // --- General / Umumiy ---
  "app_title": { ru: "ЕДЦ Аналитика", uz: "YaDM Analitika" },
  "app_subtitle": { ru: "Единый диспетчерский центр", uz: "Yagona dispetcherlik markazi" },
  "loading": { ru: "Загрузка...", uz: "Yuklanmoqda..." },
  "loading_settings": { ru: "Загрузка настроек...", uz: "Sozlamalar yuklanmoqda..." },
  "sync_archive": { ru: "Синхронизация архива...", uz: "Arxiv sinxronlanmoqda..." },
  "getting_data": { ru: "Получение данных...", uz: "Ma'lumotlar olinmoqda..." },
  "processing": { ru: "Обработка", uz: "Qayta ishlash" },
  "error": { ru: "Ошибка", uz: "Xato" },
  "save": { ru: "Сохранить", uz: "Saqlash" },
  "cancel": { ru: "Отмена", uz: "Bekor qilish" },
  "delete": { ru: "Удалить", uz: "O'chirish" },
  "apply": { ru: "Применить", uz: "Qo'llash" },
  "reset": { ru: "Сбросить", uz: "Tozalash" },
  "create": { ru: "Создать", uz: "Yaratish" },
  "done": { ru: "Готово", uz: "Tayyor" },
  "units": { ru: "ед.", uz: "birl." },
  
  // --- Sidebar / Yon menyu ---
  "nav_home": { ru: "Карта и Обзор", uz: "Xarita va Umumiy" },
  "nav_dashboard": { ru: "Дашборд", uz: "Boshqaruv Paneli" },
  "nav_input": { ru: "Загрузка данных", uz: "Ma'lumot Yuklash" },
  "nav_admin": { ru: "Настройки", uz: "Sozlamalar" },
  "nav_users": { ru: "Пользователи", uz: "Foydalanuvchilar" },
  "nav_main": { ru: "Основное", uz: "Asosiy" },
  "nav_data": { ru: "Данные", uz: "Ma'lumotlar" },
  "nav_system": { ru: "Система", uz: "Tizim" },
  "archive_date": { ru: "Архив / Дата", uz: "Arxiv / Sana" },
  "stations": { ru: "Станции", uz: "Stansiyalar" },
  "wagons": { ru: "Вагоны", uz: "Vagonlar" },

  // --- Home Page / Bosh Sahifa ---
  "map_network": { ru: "Карта сети", uz: "Tarmoq Xaritasi" },
  "select_point": { ru: "Выберите стык на карте", uz: "Xaritadan tutashuvni tanlang" },
  "border_point": { ru: "Стык", uz: "Tutashuv" },
  "total_wagons": { ru: "Всего вагонов", uz: "Jami vagonlar" },
  "import": { ru: "Импорт", uz: "Import" },
  "transit": { ru: "Транзит", uz: "Tranzit" },
  "nodes_rju": { ru: "РЖУ", uz: "MTU" },
  "no_data": { ru: "Нет данных", uz: "Ma'lumot yo'q" },
  "top_cargo": { ru: "Топ грузов", uz: "Top Yuklar" },

  // --- Dashboard / Boshqaruv Paneli ---
  "monitoring_title": { ru: "Мониторинг вагонов", uz: "Vagonlar Monitoringi" },
  "monitoring_subtitle": { ru: "Оперативная сводка и дислокация", uz: "Tezkor hisobot va dislokatsiya" },
  "report": { ru: "Отчет", uz: "Hisobot" },
  "charts": { ru: "Графики", uz: "Grafiklar" },
  "search_placeholder": { ru: "Поиск вагона, груза...", uz: "Vagon, yuk qidirish..." },
  "all_regions": { ru: "Все регионы", uz: "Barcha hududlar" },
  "processed_trains": { ru: "Обработано составов (Натурок)", uz: "Qayta ishlangan tarkiblar (Naturka)" },
  "total_qty": { ru: "Общее кол-во", uz: "Umumiy miqdor" },
  "at_border": { ru: "На границе", uz: "Chegarada" },
  "active_regions": { ru: "Активные регионы", uz: "Faol hududlar" },
  "attention_needed": { ru: "Требуют внимания", uz: "Diqqat talab" },
  "wagons_by_region": { ru: "Вагоны по региону", uz: "Hududlar kesimida vagonlar" },
  "dislocation_status": { ru: "Статус дислокации", uz: "Dislokatsiya holati" },
  "cargo_distribution": { ru: "Распределение по роду груза", uz: "Yuk turi bo'yicha taqsimot" },
  "detailed_list": { ru: "Детальный список", uz: "Batafsil ro'yxat" },
  "records": { ru: "записей", uz: "yozuvlar" },
  "internal": { ru: "Внутренние", uz: "Ichki" },
  "wagon_col": { ru: "Вагон", uz: "Vagon" },
  "cargo_col": { ru: "Груз", uz: "Yuk" },
  "weight_col": { ru: "Вес", uz: "Og'irlik" },
  "station_col": { ru: "Станция", uz: "Stansiya" },
  "region_col": { ru: "Регион", uz: "Hudud" },
  "status_col": { ru: "Статус", uz: "Holat" },
  "empty": { ru: "Порожний", uz: "Bo'sh" },
  "not_found": { ru: "Данные не найдены", uz: "Ma'lumot topilmadi" },
  "try_change_search": { ru: "Попробуйте изменить параметры поиска", uz: "Qidiruv parametrlarini o'zgartirib ko'ring" },
  "showing": { ru: "Показано", uz: "Ko'rsatilmoqda" },
  "of": { ru: "из", uz: "dan" },
  "unknown": { ru: "Неизвестно", uz: "Noma'lum" },
  "select_trains": { ru: "Выберите поезда", uz: "Poezdlarni tanlang" },
  "train_index": { ru: "Индекс поезда", uz: "Poezd indeksi" },
  "reset_selection": { ru: "Сбросить выбор", uz: "Tanlovni bekor qilish" },
  "wagons_count": { ru: "ваг.", uz: "vag." },
  "report_standard": { ru: "Стандартный отчет", uz: "Standart Hisobot" },
  "report_detailed": { ru: "Детальный отчет (Таблица)", uz: "Batafsil Hisobot (Jadval)" },

  // --- Report / Hisobot ---
  "report_daily": { ru: "Отчет за сутки", uz: "Kunlik hisobot" },
  "current_date": { ru: "Текущая дата", uz: "Joriy sana" },
  "table": { ru: "Таблица", uz: "Jadval" },
  "infographics": { ru: "Инфографика", uz: "Infografika" },
  "print": { ru: "Печать", uz: "Chop etish" },
  "mgsp_input": { ru: "МГСП (Вход)", uz: "MGSP (Kirish)" },
  "tajikistan": { ru: "Таджикистан", uz: "Tojikiston" },
  "turkmenistan": { ru: "Туркменистан", uz: "Turkmaniston" },
  "kazakhstan": { ru: "Казахстан", uz: "Qozog'iston" },
  "kyrgyzstan": { ru: "Киргизия", uz: "Qirg'iziston" },
  "afghanistan": { ru: "Афганистан", uz: "Afg'oniston" },
  "total_upper": { ru: "ИТОГО", uz: "JAMI" },
  "handover": { ru: "Сдача", uz: "Topshirish" },
  "dir1": { ru: "1-направление (Север/Восток)", uz: "1-yo'nalish (Shimol/Sharq)" },
  "dir2": { ru: "2-направление (Юг/Запад)", uz: "2-yo'nalish (Janub/G'arb)" },
  "other_unknown": { ru: "Прочие (Неопознанные)", uz: "Boshqalar (Noma'lum)" },
  "total_transit": { ru: "ВСЕГО ТРАНЗИТ", uz: "JAMI TRANZIT" },
  "import_acceptance": { ru: "Прием импорта", uz: "Import qabuli" },
  "total_import": { ru: "ВСЕГО ИМПОРТ", uz: "JAMI IMPORT" },
  "transit_entry_chart": { ru: "Транзит: По стыкам (Вход)", uz: "Tranzit: Tutashuvlar bo'yicha (Kirish)" },
  "transit_exit_chart": { ru: "Транзит: По направлениям (Выход)", uz: "Tranzit: Yo'nalishlar bo'yicha (Chiqish)" },
  "import_entry_chart": { ru: "Импорт: По стыкам (Вход)", uz: "Import: Tutashuvlar bo'yicha (Kirish)" },
  "import_region_chart": { ru: "Импорт: По регионам", uz: "Import: Hududlar bo'yicha" },
  "wagon_num_col": { ru: "Номер вагона", uz: "Vagon raqami" },
  "cargo_code_col": { ru: "Код груза", uz: "Yuk kodi" },
  "weight_ton": { ru: "Вес (т)", uz: "Og'irlik (t)" },
  "dest_station": { ru: "Станция назначения", uz: "Belgilangan stansiya" },
  "total_weight": { ru: "Общий вес", uz: "Umumiy og'irlik" },
  "without_empty": { ru: "Без порожних", uz: "Bo'sh vagonlarsiz" },

  // --- Detailed Report Translations / Batafsil Hisobot ---
  "accepted_transit_title": { ru: "ПРИНЯТЫЙ ТРАНЗИТ", uz: "QABUL QILINGAN TRANZIT" },
  "tashkent_direction": { ru: "НАПРАВЛЕНИЕ ТАШКЕНТ", uz: "TOSHKENT YO'NALISHI" },
  "accepted_import_title": { ru: "ПРИНЯТЫЙ ИМПОРТ", uz: "QABUL QILINGAN IMPORT" },
  "datyap": { ru: "МГСП", uz: "DATYAP" },
  "taj_bekabad": { ru: "ТАДЖ/БЕК", uz: "TOJ/BEK" },
  "taj_kudukli": { ru: "ТАДЖ/КУД", uz: "TOJ/KUD" },
  "turkm_short": { ru: "ТУРКМ", uz: "TURKM" },
  "kaz_short": { ru: "КАЗАХ", uz: "QOZOQ" },
  "kyrg_short": { ru: "КИРГ", uz: "QIRGIZ" },
  "galaba_short": { ru: "ГАЛАБА", uz: "GALABA" },
  "report_end_msg": { ru: "(Конец отчета)", uz: "(Hisobot yakuni)" },
  
  "distribution": { ru: "Развоз", uz: "Taqsimot" },
  "node": { ru: "Узел", uz: "Uzel" },
  "south": { ru: "Юг", uz: "Janub" },
  "center": { ru: "Центр", uz: "Markaz" },
  "havast": { ru: "Хаваст", uz: "Xovos" },
  "bekabad": { ru: "Бекабад", uz: "Bekobod" },
  "akhunbabaeva": { ru: "Ахунбабаева", uz: "Oxunboboyev" },
  "total_row": { ru: "Итого", uz: "Jami" },
  
  "wagon_type_kr": { ru: "кр", uz: "yop" }, // Kritiy (Yopiq)
  "wagon_type_pv": { ru: "пв", uz: "yo" },  // Poluvagon (Yarim ochiq)
  "wagon_type_cs": { ru: "цс", uz: "sis" }, // Cisterna (Sisterna)

  // --- Input Page / Ma'lumot Kiritish ---
  "upload_title": { ru: "Загрузка данных", uz: "Ma'lumotlarni Yuklash" },
  "selected_date": { ru: "Выбранная дата", uz: "Tanlangan sana" },
  "db_connected": { ru: "База данных подключена", uz: "Ma'lumotlar bazasi ulangan" },
  "drag_files": { ru: "Перетащите файлы", uz: "Fayllarni bu yerga tashlang" },
  "support_files": { ru: "Поддержка .txt, .log, .csv, .docx, .doc", uz: ".txt, .log, .csv, .docx, .doc qo'llab-quvvatlanadi" },
  "choose_files": { ru: "Выбрать файлы", uz: "Fayllarni tanlash" },
  "manual_input": { ru: "Ручной ввод данных", uz: "Qo'lda kiritish" },
  "ai_cleanup": { ru: "AI Очистка", uz: "AI Tozalash" },
  "process_save": { ru: "Обработать и Сохранить", uz: "Qayta ishlash va Saqlash" },
  "paste_here": { ru: "Вставьте необработанный текст здесь...", uz: "Xom matnni shu yerga qo'ying..." },
  "save_success": { ru: "Данные успешно сохранены в архив!", uz: "Ma'lumotlar arxivga muvaffaqiyatli saqlandi!" },

  // --- Admin Page / Admin Paneli ---
  "login_title": { ru: "Вход в систему", uz: "Tizimga kirish" },
  "login_subtitle": { ru: "Панель администратора UTY Logistics", uz: "UTY Logistics Admin Paneli" },
  "login_label": { ru: "Логин", uz: "Login" },
  "password_label": { ru: "Пароль", uz: "Parol" },
  "enter_login": { ru: "Введите логин", uz: "Loginni kiriting" },
  "login_btn": { ru: "Войти", uz: "Kirish" },
  "checking": { ru: "Проверка...", uz: "Tekshirilmoqda..." },
  "hello": { ru: "Привет", uz: "Salom" },
  "save_changes": { ru: "Сохранить изменения", uz: "O'zgarishlarni saqlash" },
  "all_saved": { ru: "Все сохранено", uz: "Barchasi saqlangan" },
  "saving": { ru: "Сохранение...", uz: "Saqlanmoqda..." },
  "tab_points": { ru: "Стык пункты", uz: "Tutashuv nuqtalari" },
  "tab_regions": { ru: "Границы РЖУ", uz: "MTU Chegaralari" },
  "tab_archive": { ru: "Архив", uz: "Arxiv" },
  "tab_users": { ru: "Пользователи", uz: "Foydalanuvchilar" },
  "archive_manager": { ru: "Менеджер архива", uz: "Arxiv Boshqaruvchisi" },
  "access_control": { ru: "Управление доступом", uz: "Kirish nazorati" },
  "saved_reports": { ru: "Сохраненные отчеты", uz: "Saqlangan hisobotlar" },
  "archive_empty": { ru: "Архив пуст", uz: "Arxiv bo'sh" },
  "add_admin": { ru: "Добавить администратора", uz: "Admin qo'shish" },
  "admin_list": { ru: "Список администраторов", uz: "Adminlar ro'yxati" },
  "added": { ru: "Добавлен", uz: "Qo'shilgan" },
  "edit_mode": { ru: "Редактирование", uz: "Tahrirlash" },
  "station_name": { ru: "Название станции", uz: "Stansiya nomi" },
  "move_marker": { ru: "Перемещение маркера", uz: "Markerni surish" },
  "visual_editor": { ru: "Визуальный редактор", uz: "Vizual tahrirlovchi" },
  "color": { ru: "Цвет", uz: "Rang" },
  "add_points": { ru: "Добавление точек", uz: "Nuqtalar qo'shish" },
  "delete_point": { ru: "Удаление", uz: "O'chirish" },
  "delete_confirm_title": { ru: "Удаление отчета", uz: "Hisobotni o'chirish" },
  "delete_confirm_msg": { ru: "Вы уверены, что хотите удалить отчет?", uz: "Haqiqatan ham hisobotni o'chirmoqchimisiz?" },
  "add_new_point": { ru: "Добавить новый стык", uz: "Yangi tutashuv qo'shish" },
  "code_id": { ru: "Код станции (ID)", uz: "Stansiya kodi (ID)" },
  "delete_this_point": { ru: "Удалить точку", uz: "Nuqtani o'chirish" },
  "delete_admin_title": { ru: "Удаление администратора", uz: "Adminni o'chirish" },
  "delete_admin_msg": { ru: "Вы уверены, что хотите удалить пользователя", uz: "Ushbu foydalanuvchini o'chirishga ishonchingiz komilmi" },
  "delete_point_title": { ru: "Удаление точки", uz: "Nuqtani o'chirish" },
  "delete_point_msg": { ru: "Вы уверены, что хотите удалить точку", uz: "Ushbu nuqtani o'chirishga ishonchingiz komilmi" },
  "move_marker_desc": { ru: "Используйте большой синий маркер на карте для изменения координат.", uz: "Koordinatalarni o'zgartirish uchun xaritadagi katta ko'k markerdan foydalaning." },
  "visual_editor_desc": { ru: "Перетаскивайте белые точки для изменения формы.", uz: "Shaklni o'zgartirish uchun oq nuqtalarni suring." },
  "add_points_desc": { ru: "Нажмите на полупрозрачные кружки между точками, чтобы создать новый угол.", uz: "Yangi burchak yaratish uchun nuqtalar orasidagi yarim shaffof doiralarni bosing." },
  "delete_points_desc": { ru: "Нажмите ПКМ (Правая Кнопка) на точке, чтобы удалить её.", uz: "Nuqtani o'chirish uchun uning ustiga sichqonchaning o'ng tugmasini bosing." },
  "manage_archive_desc": { ru: "Здесь вы можете просматривать и удалять сохраненные ежедневные отчеты.", uz: "Bu yerda saqlangan kunlik hisobotlarni ko'rishingiz va o'chirishingiz mumkin." },
  "access_control_desc": { ru: "Добавляйте новых администраторов и отслеживайте их активность.", uz: "Yangi adminlarni qo'shing va ularning faolligini kuzatib boring." },
  "cannot_delete_self": { ru: "Нельзя удалить самого себя!", uz: "O'zingizni o'chira olmaysiz!" },
  "error_server_delete": { ru: "Ошибка удаления с сервера", uz: "Serverdan o'chirishda xatolik" },
  "error_server_delete_msg": { ru: "Не удалось удалить с сервера. Принудительно удалить локальную копию?", uz: "Serverdan o'chirib bo'lmadi. Lokal nusxani majburan o'chirasizmi?" },
  "continue": { ru: "Продолжить", uz: "Davom etish" },
  "region_name": { ru: "Название региона", uz: "Hudud nomi" },

  // --- Dynamic Regions & Cargo / Dinamik Hududlar va Yuklar ---
  "region_tashkent": { ru: "Ташкент", uz: "Toshkent" },
  "region_kokand": { ru: "Коканд", uz: "Qo'qon" },
  "region_bukhara": { ru: "Бухара", uz: "Buxoro" },
  "region_kungrad": { ru: "Кунград", uz: "Qo'ng'irot" },
  "region_karshi": { ru: "Карши", uz: "Qarshi" },
  "region_termez": { ru: "Термез", uz: "Termiz" },
  "region_other": { ru: "Другие ЖД / СНГ", uz: "Boshqa TY / MDH" },
  
  // No longer needed as separate entries, but kept for fallback
  "cargo_generic": { ru: "Груз", uz: "Yuk" },
};

export const getTranslation = (key: string, lang: Language): string => {
  if (!dictionary[key]) return key;
  return dictionary[key][lang] || dictionary[key]['ru'];
};

export const getRegionName = (rawName: string, lang: Language): string => {
   const regionTerm = lang === 'ru' ? 'РЖУ' : 'MTU';
   const lowerName = rawName.toLowerCase();

   if (lowerName.includes("ташкент") || lowerName.includes("toshkent")) return `${getTranslation("region_tashkent", lang)} (${regionTerm}-1)`;
   if (lowerName.includes("коканд") || lowerName.includes("qo'qon") || lowerName.includes("qoqon")) return `${getTranslation("region_kokand", lang)} (${regionTerm}-2)`;
   if (lowerName.includes("бухара") || lowerName.includes("buxoro")) return `${getTranslation("region_bukhara", lang)} (${regionTerm}-3)`;
   if (lowerName.includes("кунград") || lowerName.includes("qo'ng'irot") || lowerName.includes("qongirot")) return `${getTranslation("region_kungrad", lang)} (${regionTerm}-4)`;
   if (lowerName.includes("карши") || lowerName.includes("qarshi")) return `${getTranslation("region_karshi", lang)} (${regionTerm}-5)`;
   if (lowerName.includes("термез") || lowerName.includes("termiz")) return `${getTranslation("region_termez", lang)} (${regionTerm}-6)`;

   return rawName;
};

export const getCargoNameTranslated = (code: string | undefined, lang: Language): string => {
  if (!code) return getTranslation("unknown", lang);
  return analyzeCargoCode(code);
};
