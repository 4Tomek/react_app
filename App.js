import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

// Podmíněná inicializace databáze (pouze pro mobil)
const db = Platform.OS !== 'web' ? SQLite.openDatabaseSync('artworks.db') : null;

// Mock data pro web
const WEB_INITIAL_DATA = [
  {
    id: 'SA-1',
    title: 'Kleobis a Bitón',
    title_en: 'Kleobis and Biton',
    author: 'Polymédés z Argu',
    author_en: 'Polymedes of Argos',
    year_start: -580,
    year_end: -580,
    picture: 'https://raw.githubusercontent.com/4Tomek/art_images/main/images/Sochařství_Antika_Kleobis_and_Biton_Polymedes.jpg',
    textbook: 'Sochařství Antika',
    note: 'Dvě archaické mramorové sochy (kúroi) připisované Polymédovi z Argu. Představují bratry, kteří podle legendy zemřeli v naprostém štěstí poté, co vlastními silami dotáhli vůz své matky k chrámu. Delfy, Archeologické muzeum.',
    note_en: 'Two archaic marble statues (kouroi) attributed to Polymedes of Argos. They represent brothers who, according to legend, died in total happiness after pulling their mother\'s chariot to the temple themselves. Delphi, Archaeological Museum.',
    is_active: 1
  },
  {
    id: 'SA-2',
    title: 'Vozataj z Delf',
    title_en: 'Charioteer of Delphi',
    author: 'Sotadés z Thespií ?',
    author_en: 'Sotades of Thespiae ?',
    year_start: -478,
    year_end: -474,
    picture: 'https://raw.githubusercontent.com/4Tomek/art_images/main/images/Sochařství_Antika_Charioteer_of_Delphi_Joy_of_Museums_2.jpg',
    textbook: 'Sochařství Antika',
    note: 'Jedna z nejvýznamnějších dochovaných řeckých bronzových soch. Představuje vítěze závodů v Delfách v tzv. přísném stylu. Původně byla součástí většího sousoší s vozem a koňmi. Bronz, výška 180 cm. Delfy, Archeologické muzeum.',
    note_en: 'One of the most important surviving Greek bronze statues. It represents a chariot race winner in Delphi in the so-called Severe style. It was originally part of a larger group with a chariot and horses. Bronze, height 180 cm. Delphi, Archaeological Museum.',
    is_active: 1
  },
  {
    id: 'SA-3',
    title: 'Diskobolos',
    title_en: 'Discobolus',
    author: 'Myrón',
    author_en: 'Myron',
    year_start: -460,
    year_end: -450,
    picture: 'https://raw.githubusercontent.com/4Tomek/art_images/main/images/Sochařství_Antika_Discobolo.jpg',
    textbook: 'Sochařství Antika',
    note: 'Klasické řecké dílo zachycující atleta v okamžiku maximálního napětí těsně před odhozením disku. Originál byl bronzový, dochovaly se pouze římské mramorové kopie. Příklad raného realismu v pohybu. Národní muzeum, Řím.',
    note_en: 'A classical Greek work capturing an athlete at the moment of maximum tension just before throwing the disc. The original was bronze, only Roman marble copies have survived. An example of early realism in movement. National Museum, Rome.',
    is_active: 1
  }
];

// Web storage pro simulaci databáze
let webArtworks = [...WEB_INITIAL_DATA];
let webSettings = {
  rounds: 3,
  rows: JSON.stringify(['Title', 'Author', 'Year']),
  active_rows: JSON.stringify([1, 1, 1]),
  textbooks: JSON.stringify(['Sochařství Antika']),
  active_textbooks: JSON.stringify([1]),
  english: 0
};

// Database wrapper - funguje na webu i mobilu
const dbWrapper = {
  // Provádění SQL příkazů (CREATE TABLE, INSERT atd.)
  execAsync: async (sql) => {
    if (Platform.OS === 'web') {
      console.log('[Web] Skipping SQL exec:', sql.substring(0, 50) + '...');
      return;
    }
    return db.execAsync(sql);
  },
  
  // SELECT dotazy
  getAllAsync: async (query, params = []) => {
    if (Platform.OS === 'web') {
      console.log('[Web] Mock query:', query);
      
      // Simulace SELECT * FROM settings
      if (query.includes('SELECT') && query.includes('settings')) {
        return [{
          id: 1,
          rounds: webSettings.rounds,
          rows: webSettings.rows,
          active_rows: webSettings.active_rows,
          textbooks: webSettings.textbooks,
          active_textbooks: webSettings.active_textbooks,
          english: webSettings.english
        }];
      }
      
      // Simulace SELECT COUNT
      if (query.includes('COUNT')) {
        if (query.includes('artworks')) {
          return [{ count: webArtworks.length }];
        }
        if (query.includes('settings')) {
          return [{ count: 1 }];
        }
      }
      
      // Simulace SELECT * FROM artworks
      if (query.includes('SELECT') && query.includes('artworks')) {
        let results = [...webArtworks];
        
        // Filter WHERE textbook = ?
        if (query.includes('WHERE textbook')) {
          const textbook = params[0];
          results = results.filter(a => a.textbook === textbook);
        }
        
        // Filter WHERE is_active = 1
        if (query.includes('is_active = 1')) {
          results = results.filter(a => a.is_active === 1);
        }
        
        // Filter NOT IN (used IDs)
        if (query.includes('NOT IN')) {
          const usedIds = params;
          results = results.filter(a => !usedIds.includes(a.id));
        }
        
        return results;
      }
      
      return [];
    }
    return db.getAllAsync(query, params);
  },
  
  // INSERT, UPDATE, DELETE
  runAsync: async (query, params = []) => {
    if (Platform.OS === 'web') {
      console.log('[Web] Mock run:', query.substring(0, 80));
      
      // UPDATE settings
      if (query.includes('UPDATE settings')) {
        if (query.includes('rounds')) webSettings.rounds = params[0];
        if (query.includes('active_rows')) webSettings.active_rows = params[0];
        if (query.includes('textbooks')) {
          webSettings.textbooks = params[0];
          if (params[1]) webSettings.active_textbooks = params[1];
        }
        if (query.includes('english')) webSettings.english = params[params.length - 1];
        return;
      }
      
      // UPDATE artworks
      if (query.includes('UPDATE artworks')) {
        const isActive = params[0];
        const id = params[1];
        const artwork = webArtworks.find(a => a.id === id);
        if (artwork) artwork.is_active = isActive;
        return;
      }
      
      // INSERT artworks
      if (query.includes('INSERT INTO artworks')) {
        // Mock - data jsou už v WEB_INITIAL_DATA
        return;
      }
      
      return;
    }
    return db.runAsync(query, params);
  }
};

// Funkce pro odstranění diakritiky
const removeDiacritics = (str) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

// Funkce pro porovnání slov (alespoň 1 slovo min 3 znaky se musí shodovat)
const wordsMatch = (userAnswer, correctAnswer) => {
  // Rozdělit na slova a filtrovat slova >= 3 znaky (odstranit diakritiku i z user inputu)
  const userWords = removeDiacritics(userAnswer)
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length >= 3);
  
  // Ze správné odpovědi odstranit diakritiku a rozdělit na slova >= 3 znaky
  const correctWords = removeDiacritics(correctAnswer)
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length >= 3);
  
  // Ověřit, zda se alespoň jedno slovo shoduje
  return userWords.some(userWord => 
    correctWords.some(correctWord => correctWord === userWord)
  );
};

export default function App() {
  const [screen, setScreen] = useState('home'); // 'home', 'quiz', 'results', 'settings', 'learn'
  const [selectedRounds, setSelectedRounds] = useState(3);
  const [isEnglish, setIsEnglish] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState({
    title: true,
    author: true,
    year: true,
  });
  const [settingsData, setSettingsData] = useState({
    textbooks: ['Basic Textbook', 'Textbook 1'],
    activeTextbooks: [1, 0],
    artworksByTextbook: {},
  });
  const [tempSettings, setTempSettings] = useState(null);
  const [originalSettings, setOriginalSettings] = useState(null);
  const [expandedTextbooks, setExpandedTextbooks] = useState({});
  const [learnArtworks, setLearnArtworks] = useState([]);
  const [currentLearnIndex, setCurrentLearnIndex] = useState(0);
  const [showNoteInLearn, setShowNoteInLearn] = useState(false);
  const [showNoteInQuiz, setShowNoteInQuiz] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentArtwork, setCurrentArtwork] = useState(null);
  const [usedIds, setUsedIds] = useState([]);
  const [titleInput, setTitleInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [scores, setScores] = useState({
    titles: 0,
    authors: 0,
    years: 0,
  });
  const [currentYearDiff, setCurrentYearDiff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUserAnswers, setShowUserAnswers] = useState({
    title: false,
    author: false,
    year: false,
  });
  const [imageZoomVisible, setImageZoomVisible] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Refs pro navigaci mezi poli
  const authorInputRef = useRef(null);
  const yearInputRef = useRef(null);

  // Inicializace databáze
  useEffect(() => {
    initDatabase();
  }, []);

  const toggleCategory = (category) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const updateRounds = (rounds) => {
    setSelectedRounds(rounds);
  };

  const updateCategories = async () => {
    try {
      const activeRows = [
        selectedCategories.title ? 1 : 0,
        selectedCategories.author ? 1 : 0,
        selectedCategories.year ? 1 : 0,
      ];
      await dbWrapper.runAsync(
        'UPDATE settings SET active_rows = ? WHERE id = 1',
        [JSON.stringify(activeRows)]
      );
    } catch (error) {
      console.error('Chyba při ukládání kategorií:', error);
    }
  };

  const initDatabase = async () => {
    try {
      // Vytvoření tabulky artworks
      await dbWrapper.execAsync(`
        CREATE TABLE IF NOT EXISTS artworks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          title_en TEXT NOT NULL,
          author TEXT NOT NULL,
          author_en TEXT NOT NULL,
          year_start INTEGER NOT NULL,
          year_end INTEGER NOT NULL,
          picture TEXT NOT NULL,
          textbook TEXT NOT NULL,
          note TEXT NOT NULL,
          note_en TEXT NOT NULL,
          is_active INTEGER NOT NULL
        );
      `);

      // Vytvoření tabulky settings
      await dbWrapper.execAsync(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY,
          rounds INTEGER NOT NULL,
          rows TEXT NOT NULL,
          active_rows TEXT NOT NULL,
          textbooks TEXT NOT NULL,
          active_textbooks TEXT NOT NULL,
          english INTEGER NOT NULL
        );
      `);

      // Kontrola, zda je databáze artworks prázdná
      const artworksResult = await dbWrapper.getAllAsync('SELECT COUNT(*) as count FROM artworks');
      
      if (artworksResult[0].count === 0) {
        // Vložení počátečních dat do artworks
        await dbWrapper.runAsync(
          `INSERT INTO artworks (id, title, title_en, author, author_en, year_start, year_end, picture, textbook, note, note_en, is_active) VALUES 
          ('SA-1', 'Kleobis a Bitón', 'Kleobis and Biton', 'Polymédés z Argu', 'Polymedes of Argos', -580, -580, 'https://raw.githubusercontent.com/4Tomek/art_images/main/images/Sochařství_Antika_Kleobis_and_Biton_Polymedes.jpg', 'Sochařství Antika', 'Dvě archaické mramorové sochy (kúroi) připisované Polymédovi z Argu. Představují bratry, kteří podle legendy zemřeli v naprostém štěstí poté, co vlastními silami dotáhli vůz své matky k chrámu. Delfy, Archeologické muzeum.', 'Two archaic marble statues (kouroi) attributed to Polymedes of Argos. They represent brothers who, according to legend, died in total happiness after pulling their mother''s chariot to the temple themselves. Delphi, Archaeological Museum.', 1),
          ('SA-2', 'Vozataj z Delf', 'Charioteer of Delphi', 'Sotadés z Thespií ?', 'Sotades of Thespiae ?', -478, -474, 'https://raw.githubusercontent.com/4Tomek/art_images/main/images/Sochařství_Antika_Charioteer_of_Delphi_Joy_of_Museums_2.jpg', 'Sochařství Antika', 'Jedna z nejvýznamnějších dochovaných řeckých bronzových soch. Představuje vítěze závodů v Delfách v tzv. přísném stylu. Původně byla součástí většího sousoší s vozem a koňmi. Bronz, výška 180 cm. Delfy, Archeologické muzeum.', 'One of the most important surviving Greek bronze statues. It represents a chariot race winner in Delphi in the so-called Severe style. It was originally part of a larger group with a chariot and horses. Bronze, height 180 cm. Delphi, Archaeological Museum.', 1),
          ('SA-3', 'Diskobolos', 'Discobolus', 'Myrón', 'Myron', -460, -450, 'https://raw.githubusercontent.com/4Tomek/art_images/main/images/Sochařství_Antika_Discobolo.jpg', 'Sochařství Antika', 'Klasické řecké dílo zachycující atleta v okamžiku maximálního napětí těsně před odhozením disku. Originál byl bronzový, dochovaly se pouze římské mramorové kopie. Příklad raného realismu v pohybu. Národní muzeum, Řím.', 'A classical Greek work capturing an athlete at the moment of maximum tension just before throwing the disc. The original was bronze, only Roman marble copies have survived. An example of early realism in movement. National Museum, Rome.', 1)`
        );
        console.log('Data artworks byla vložena do databáze');
      }

      // Kontrola, zda je databáze settings prázdná
      const settingsResult = await dbWrapper.getAllAsync('SELECT COUNT(*) as count FROM settings');
      
      if (settingsResult[0].count === 0) {
        // Vložení výchozích nastavení
        await dbWrapper.runAsync(
          `INSERT INTO settings (id, rounds, rows, active_rows, textbooks, active_textbooks, english) VALUES 
          (1, 3, '["Title","Author","Year"]', '[1,1,1]', '["Sochařství Antika"]', '[1]', 0)`
        );
        console.log('Výchozí nastavení bylo vloženo do databáze');
      }

      // Načtení settings
      await loadSettings();
      
      setLoading(false);
    } catch (error) {
      console.error('Chyba při inicializaci databáze:', error);
      Alert.alert('Chyba', 'Nepodařilo se inicializovat databázi');
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await dbWrapper.getAllAsync('SELECT * FROM settings WHERE id = 1');
      if (settings.length > 0) {
        const s = settings[0];
        const textbooks = JSON.parse(s.textbooks);
        const activeTextbooks = JSON.parse(s.active_textbooks);
        const activeRows = JSON.parse(s.active_rows);
        
        setSelectedRounds(s.rounds);
        setIsEnglish(s.english === 1);
        setSelectedCategories({
          title: activeRows[0] === 1,
          author: activeRows[1] === 1,
          year: activeRows[2] === 1,
        });

        // Načtení artworks po učebnicích
        const artworksByTextbook = {};
        for (const textbook of textbooks) {
          const artworks = await dbWrapper.getAllAsync(
            'SELECT * FROM artworks WHERE textbook = ?',
            [textbook]
          );
          artworksByTextbook[textbook] = artworks;
        }

        setSettingsData({
          textbooks,
          activeTextbooks,
          artworksByTextbook,
        });
      }
    } catch (error) {
      console.error('Chyba při načítání nastavení:', error);
    }
  };

  const saveSettings = async (tempData) => {
    try {
      const activeRows = [
        selectedCategories.title ? 1 : 0,
        selectedCategories.author ? 1 : 0,
        selectedCategories.year ? 1 : 0,
      ];

      await dbWrapper.runAsync(
        `UPDATE settings SET 
          rounds = ?, 
          active_rows = ?, 
          active_textbooks = ?,
          english = ?
        WHERE id = 1`,
        [selectedRounds, JSON.stringify(activeRows), JSON.stringify(tempData.activeTextbooks), isEnglish ? 1 : 0]
      );

      // Uložení is_active pro artworks
      for (const textbook in tempData.artworksByTextbook) {
        for (const artwork of tempData.artworksByTextbook[textbook]) {
          await dbWrapper.runAsync(
            'UPDATE artworks SET is_active = ? WHERE id = ?',
            [artwork.is_active, artwork.id]
          );
        }
      }

      await loadSettings();
      console.log('Nastavení bylo uloženo');
    } catch (error) {
      console.error('Chyba při ukládání nastavení:', error);
      Alert.alert('Chyba', 'Nepodařilo se uložit nastavení');
    }
  };

  const refreshData = async () => {
    try {
      Alert.alert('Potvrzení', 'Opravdu chcete obnovit data z internetu?', [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Ano',
          onPress: async () => {
            try {
              const response = await fetch('https://raw.githubusercontent.com/4Tomek/art_images/main/artworks.json');
              const data = await response.json();
              
              // Načíst aktuální textbooks z settings
              const settings = await dbWrapper.getAllAsync('SELECT * FROM settings WHERE id = 1');
              let textbooks = JSON.parse(settings[0].textbooks);
              let activeTextbooks = JSON.parse(settings[0].active_textbooks);
              
              for (const item of data) {
                // Zkontrolovat zda již existuje
                const existing = await dbWrapper.getAllAsync(
                  'SELECT * FROM artworks WHERE id = ?',
                  [item.id]
                );
                
                if (existing.length === 0) {
                  // Zkontrolovat zda učebnice existuje v settings
                  if (!textbooks.includes(item.category)) {
                    textbooks.push(item.category);
                    activeTextbooks.push(0); // Nová učebnice je defaultně neaktivní
                  }
                  
                  // Vložit nové dílo
                  await dbWrapper.runAsync(
                    `INSERT INTO artworks (id, title, title_en, author, author_en, year_start, year_end, picture, textbook, note, note_en, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      item.id,
                      item.title,
                      item.title_en,
                      item.artist,
                      item.artist_en,
                      item.year_start,
                      item.year_end,
                      item.image_url,
                      item.category,
                      item.note,
                      item.note_en,
                      item.is_active
                    ]
                  );
                }
              }
              
              // Uložit aktualizované textbooks
              await dbWrapper.runAsync(
                'UPDATE settings SET textbooks = ?, active_textbooks = ? WHERE id = 1',
                [JSON.stringify(textbooks), JSON.stringify(activeTextbooks)]
              );
              
              await loadSettings();
              
              // Znovu načíst tempSettings s novými učebnicemi
              const newSettings = await dbWrapper.getAllAsync('SELECT * FROM settings WHERE id = 1');
              const s = newSettings[0];
              const newTextbooks = JSON.parse(s.textbooks);
              const newActiveTextbooks = JSON.parse(s.active_textbooks);

              // Načíst artworks po učebnicích
              const newArtworksByTextbook = {};
              for (const textbook of newTextbooks) {
                const artworks = await dbWrapper.getAllAsync(
                  'SELECT * FROM artworks WHERE textbook = ?',
                  [textbook]
                );
                newArtworksByTextbook[textbook] = artworks;
              }

              // Aktualizovat tempSettings
              setTempSettings({
                textbooks: newTextbooks,
                activeTextbooks: newActiveTextbooks,
                artworksByTextbook: newArtworksByTextbook,
              });
              
              // Uložit aktuální nastavení
              await saveSettings({
                textbooks: newTextbooks,
                activeTextbooks: newActiveTextbooks,
                artworksByTextbook: newArtworksByTextbook,
              });
              
              Alert.alert('Hotovo', 'Data byla aktualizována');
            } catch (error) {
              console.error('Chyba při stahování dat:', error);
              Alert.alert('Chyba', 'Nepodařilo se stáhnout data z internetu');
            }
          }
        }
      ]);
    } catch (error) {
      console.error('Chyba:', error);
    }
  };

  const startQuiz = async () => {
    setScreen('quiz');
    setCurrentRound(1);
    setUsedIds([]);
    setScores({ titles: 0, authors: 0, years: 0 });
    await loadRandomArtwork([]);
  };

  const startLearn = async () => {
    try {
      // Vytvoření seznamu aktivních učebnic
      const activeTextbookNames = settingsData.textbooks.filter((_, index) => 
        settingsData.activeTextbooks[index] === 1
      );

      if (activeTextbookNames.length === 0) {
        Alert.alert('Chyba', 'Žádná učebnice není aktivní. Prosím zapněte alespoň jednu učebnici v nastavení.');
        return;
      }

      // Načtení všech aktivních artworks seřazených podle roku a názvu
      const textbookPlaceholders = activeTextbookNames.map(() => '?').join(',');
      const query = `SELECT * FROM artworks 
                     WHERE is_active = 1 AND textbook IN (${textbookPlaceholders})
                     ORDER BY year_start ASC, title ASC`;
      
      const result = await dbWrapper.getAllAsync(query, activeTextbookNames);
      
      if (result.length === 0) {
        Alert.alert('Chyba', 'Žádná díla nejsou aktivní. Prosím zapněte alespoň jedno dílo v nastavení.');
        return;
      }

      setImageLoading(true);
      setLearnArtworks(result);
      setCurrentLearnIndex(0);
      setScreen('learn');
    } catch (error) {
      console.error('Chyba při načítání děl pro učení:', error);
      Alert.alert('Chyba', 'Nepodařilo se načíst díla');
    }
  };

  const loadRandomArtwork = async (excludeIds) => {
    try {
      // Vytvoření seznamu aktivních učebnic
      const activeTextbookNames = settingsData.textbooks.filter((_, index) => 
        settingsData.activeTextbooks[index] === 1
      );

      if (activeTextbookNames.length === 0) {
        Alert.alert('Chyba', 'Žádná učebnice není aktivní. Prosím zapněte alespoň jednu učebnici v nastavení.');
        setScreen('home');
        return;
      }

      // Vytvoření SQL dotazu s filtrem
      const textbookPlaceholders = activeTextbookNames.map(() => '?').join(',');
      const excludePlaceholders = excludeIds.length > 0 ? excludeIds.map(() => '?').join(',') : '';
      
      let query = `SELECT * FROM artworks WHERE is_active = 1 AND textbook IN (${textbookPlaceholders})`;
      let params = [...activeTextbookNames];
      
      if (excludeIds.length > 0) {
        query += ` AND id NOT IN (${excludePlaceholders})`;
        params = [...params, ...excludeIds];
      }
      
      query += ' ORDER BY RANDOM() LIMIT 1';
      
      const result = await dbWrapper.getAllAsync(query, params);
      
      if (result.length > 0) {
        setImageLoading(true);
        setCurrentArtwork(result[0]);
        setTitleInput('');
        setAuthorInput('');
        setYearInput('');
        setShowAnswer(false);
        setCurrentYearDiff(null);
        setShowUserAnswers({ title: false, author: false, year: false });
      } else {
        // Žádné další obrázky
        showResults();
      }
    } catch (error) {
      console.error('Chyba při načítání obrázku:', error);
      Alert.alert('Chyba', 'Nepodařilo se načíst obrázek');
    }
  };

  const handleSubmit = () => {
    if (!currentArtwork) return;

    let newScores = { ...scores };
    let yearDiff = null;
    let newShowUserAnswers = { title: false, author: false, year: false };

    // Vyhodnocení title - alespoň 1 slovo (min 3 znaky) se musí shodovat
    if (selectedCategories.title) {
      const isCorrect = titleInput.trim() && wordsMatch(titleInput.trim(), currentArtwork.title);
      if (isCorrect) {
        newScores.titles += 1;
        newShowUserAnswers.title = false; // Správná = sbaleno
      } else {
        newShowUserAnswers.title = false; // Špatná = také sbaleno
      }
    }

    // Vyhodnocení author - alespoň 1 slovo (min 3 znaky) se musí shodovat
    if (selectedCategories.author) {
      const isCorrect = authorInput.trim() && wordsMatch(authorInput.trim(), currentArtwork.author);
      if (isCorrect) {
        newScores.authors += 1;
        newShowUserAnswers.author = false; // Správná = sbaleno
      } else {
        newShowUserAnswers.author = false; // Špatná = také sbaleno
      }
    }

    // Vyhodnocení year
    if (selectedCategories.year) {
      const year = parseInt(yearInput.trim());
      if (yearInput.trim() === '' || isNaN(year)) {
        // Penalizace za nevyplnění nebo neplatné číslo
        newScores.years += 500;
        yearDiff = 'penalty: +500';
        newShowUserAnswers.year = false; // Špatná = sbaleno
      } else {
        if (year < currentArtwork.year_start) {
          const diff = currentArtwork.year_start - year;
          newScores.years += diff;
          yearDiff = `+${diff}`;
          newShowUserAnswers.year = false; // Špatná = sbaleno
        } else if (year > currentArtwork.year_end) {
          const diff = year - currentArtwork.year_end;
          newScores.years += diff;
          yearDiff = `+${diff}`;
          newShowUserAnswers.year = false; // Špatná = sbaleno
        } else {
          // Rok je v rozmezí - nevypisovat nic
          yearDiff = null;
          newShowUserAnswers.year = false; // Správná = sbaleno
        }
      }
    }

    setScores(newScores);
    setCurrentYearDiff(yearDiff);
    setShowUserAnswers(newShowUserAnswers);
    setShowAnswer(true);
  };

  const handleNext = async () => {
    const newUsedIds = [...usedIds, currentArtwork.id];
    setUsedIds(newUsedIds);
    setShowNoteInQuiz(false);

    if (currentRound < selectedRounds) {
      setCurrentRound(currentRound + 1);
      await loadRandomArtwork(newUsedIds);
    } else {
      showResults();
    }
  };

  const showResults = () => {
    setScreen('results');
  };

  const resetQuiz = () => {
    setScreen('home');
    setCurrentRound(1);
    setCurrentArtwork(null);
    setUsedIds([]);
    setTitleInput('');
    setAuthorInput('');
    setYearInput('');
    setShowAnswer(false);
    setScores({ titles: 0, authors: 0, years: 0 });
    setCurrentYearDiff(null);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Načítání...</Text>
      </View>
    );
  }

  // Úvodní obrazovka
  if (screen === 'home') {
    return (
      <View style={styles.container}>
        <View style={styles.homeHeader}>
          <TouchableOpacity 
            style={styles.settingsIcon}
            onPress={() => {
              setTempSettings(JSON.parse(JSON.stringify(settingsData)));
              setOriginalSettings({
                categories: { ...selectedCategories },
                rounds: selectedRounds,
                english: isEnglish
              });
              setScreen('settings');
            }}
          >
            <Ionicons name="settings-outline" size={32} color="#757575" />
          </TouchableOpacity>
        </View>

        <View style={styles.homeCenter}>
          <Text style={styles.title}>Kvíz uměleckých děl</Text>
        </View>

        <View style={styles.homeBottom}>
          <TouchableOpacity 
            style={[styles.startButton, { backgroundColor: '#2196F3', marginBottom: 15, alignSelf: 'stretch' }]} 
            onPress={startLearn}
          >
            <Text style={styles.startButtonText}>UČIT SE</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.startButton, { alignSelf: 'stretch' }]} onPress={startQuiz}>
            <Text style={styles.startButtonText}>KVÍZ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Settings obrazovka
  if (screen === 'settings' && tempSettings) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { fontSize: 24 }]}>Nastavení</Text>

        {/* Kategorie */}
        <Text style={[styles.subtitle, { fontSize: 16 }]}>Kategorie:</Text>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[
              styles.categoryButton,
              selectedCategories.title && styles.categoryButtonSelected,
            ]}
            onPress={() => toggleCategory('title')}
          >
            <Text
              style={[
                styles.categoryButtonText,
                selectedCategories.title && styles.categoryButtonTextSelected,
              ]}
            >
              Dílo
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.categoryButton,
              selectedCategories.author && styles.categoryButtonSelected,
            ]}
            onPress={() => toggleCategory('author')}
          >
            <Text
              style={[
                styles.categoryButtonText,
                selectedCategories.author && styles.categoryButtonTextSelected,
              ]}
            >
              Autor
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.categoryButton,
              selectedCategories.year && styles.categoryButtonSelected,
            ]}
            onPress={() => toggleCategory('year')}
          >
            <Text
              style={[
                styles.categoryButtonText,
                selectedCategories.year && styles.categoryButtonTextSelected,
              ]}
            >
              Rok
            </Text>
          </TouchableOpacity>
        </View>

        {/* Počet kol */}
        <Text style={[styles.subtitle, { fontSize: 16 }]}>Počet kol:</Text>
        <View style={styles.buttonGroup}>
          {[1, 3, 7].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.roundButton,
                selectedRounds === num && styles.roundButtonSelected,
              ]}
              onPress={() => updateRounds(num)}
            >
              <Text
                style={[
                  styles.roundButtonText,
                  selectedRounds === num && styles.roundButtonTextSelected,
                ]}
              >
                {num} {num === 1 ? 'kolo' : num < 5 ? 'kola' : 'kol'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Jazyk */}
        <Text style={[styles.subtitle, { fontSize: 16 }]}>Jazyk:</Text>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[
              styles.categoryButton,
              !isEnglish && styles.categoryButtonSelected,
            ]}
            onPress={() => setIsEnglish(false)}
          >
            <Text
              style={[
                styles.categoryButtonText,
                !isEnglish && styles.categoryButtonTextSelected,
              ]}
            >
              Česky
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.categoryButton,
              isEnglish && styles.categoryButtonSelected,
            ]}
            onPress={() => setIsEnglish(true)}
          >
            <Text
              style={[
                styles.categoryButtonText,
                isEnglish && styles.categoryButtonTextSelected,
              ]}
            >
              English
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.subtitle, { fontSize: 16 }]}>Učebnice:</Text>
        
        {tempSettings.textbooks.map((textbook, index) => {
          const isExpanded = expandedTextbooks[textbook];
          const artworks = tempSettings.artworksByTextbook[textbook] || [];
          const isActive = tempSettings.activeTextbooks[index] === 1;

          return (
            <View key={textbook} style={styles.textbookContainer}>
              {/* Textbook header with checkbox */}
              <TouchableOpacity
                style={styles.textbookHeader}
                onPress={() => {
                  const newActive = [...tempSettings.activeTextbooks];
                  newActive[index] = newActive[index] === 1 ? 0 : 1;
                  setTempSettings({
                    ...tempSettings,
                    activeTextbooks: newActive,
                  });
                }}
              >
                <View style={styles.checkboxRow}>
                  <View style={[styles.checkbox, isActive && styles.checkboxChecked]}>
                    {isActive && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                  <Text style={styles.textbookTitle}>{textbook}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setExpandedTextbooks({
                      ...expandedTextbooks,
                      [textbook]: !isExpanded,
                    });
                  }}
                >
                  <Ionicons 
                    name={isExpanded ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </TouchableOpacity>

              {/* Expanded artworks list */}
              {isExpanded && (
                <View style={styles.artworksContainer}>
                  {artworks.map((artwork) => (
                    <TouchableOpacity
                      key={artwork.id}
                      style={styles.artworkRow}
                      onPress={() => {
                        const updatedArtworks = [...artworks];
                        const artworkIndex = updatedArtworks.findIndex(a => a.id === artwork.id);
                        updatedArtworks[artworkIndex] = {
                          ...updatedArtworks[artworkIndex],
                          is_active: updatedArtworks[artworkIndex].is_active === 1 ? 0 : 1,
                        };
                        setTempSettings({
                          ...tempSettings,
                          artworksByTextbook: {
                            ...tempSettings.artworksByTextbook,
                            [textbook]: updatedArtworks,
                          },
                        });
                      }}
                    >
                      <View style={[styles.checkbox, artwork.is_active === 1 && styles.checkboxChecked]}>
                        {artwork.is_active === 1 && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                      <Text style={styles.artworkText}>{artwork.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Aktualizovat učebnice button */}
        <TouchableOpacity 
          style={[styles.startButton, { 
            backgroundColor: '#FF9800', 
            marginHorizontal: 20, 
            marginTop: 20,
            paddingVertical: 10,
            paddingHorizontal: 30
          }]}
          onPress={refreshData}
        >
          <Text style={[styles.startButtonText, { fontSize: 16 }]}>AKTUALIZOVAT UČEBNICE</Text>
        </TouchableOpacity>

        {/* Buttons */}
        <View style={styles.settingsButtons}>
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: '#757575', flex: 1, marginRight: 5, paddingHorizontal: 8 }]}
            onPress={() => {
              // Vrátit původní stav
              if (originalSettings) {
                setSelectedCategories(originalSettings.categories);
                setSelectedRounds(originalSettings.rounds);
                setIsEnglish(originalSettings.english);
              }
              setScreen('home');
              setTempSettings(null);
              setOriginalSettings(null);
              setExpandedTextbooks({});
            }}
          >
            <Text style={[styles.startButtonText, { fontSize: 13 }]} numberOfLines={1}>NEUKLÁDAT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: '#4CAF50', flex: 1, marginLeft: 5, paddingHorizontal: 8 }]}
            onPress={async () => {
              await saveSettings(tempSettings);
              setScreen('home');
              setOriginalSettings(null);
              setExpandedTextbooks({});
            }}
          >
            <Text style={[styles.startButtonText, { fontSize: 13 }]} numberOfLines={1}>ULOŽIT</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Learn obrazovka
  if (screen === 'learn' && learnArtworks.length > 0) {
    const currentArtwork = learnArtworks[currentLearnIndex];
    
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {imageLoading && (
          <View style={styles.imageLoader}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        )}
        <Image
          source={{ uri: currentArtwork.picture }}
          style={styles.learnImage}
          resizeMode="contain"
          onLoadStart={() => setImageLoading(true)}
          onLoadEnd={() => setImageLoading(false)}
        />

        <View style={styles.learnInfoContainer}>
          <View style={styles.learnInfoRow}>
            <Ionicons name="image-outline" size={20} color="#666" style={styles.learnIcon} />
            <Text style={styles.learnInfoText}>{isEnglish ? currentArtwork.title_en : currentArtwork.title}</Text>
          </View>

          <View style={styles.learnInfoRow}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.learnIcon} />
            <Text style={styles.learnInfoText}>{isEnglish ? currentArtwork.author_en : currentArtwork.author}</Text>
          </View>

          <View style={styles.learnInfoRow}>
            <Ionicons name="calendar-outline" size={20} color="#666" style={styles.learnIcon} />
            <Text style={styles.learnInfoText}>
              {currentArtwork.year_start === currentArtwork.year_end 
                ? currentArtwork.year_start 
                : `${currentArtwork.year_start}-${currentArtwork.year_end}`}
            </Text>
          </View>

          {/* Info button */}
          <TouchableOpacity 
            style={styles.infoButton}
            onPress={() => setShowNoteInLearn(!showNoteInLearn)}
          >
            <Ionicons name="information-circle-outline" size={24} color="#2196F3" />
            <Text style={styles.infoButtonText}>Info</Text>
          </TouchableOpacity>

          {/* Note */}
          {showNoteInLearn && (
            <View style={styles.noteContainer}>
              <Text style={styles.noteText}>{isEnglish ? currentArtwork.note_en : currentArtwork.note}</Text>
            </View>
          )}
        </View>

        <View style={styles.learnButtons}>
          <TouchableOpacity
            style={[styles.learnButton, { backgroundColor: '#757575', flex: 1, marginRight: 10 }]}
            onPress={() => {
              setScreen('home');
              setLearnArtworks([]);
              setCurrentLearnIndex(0);
              setShowNoteInLearn(false);
            }}
          >
            <Text style={styles.learnButtonText} numberOfLines={1}>MENU</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.learnButton, { backgroundColor: '#4CAF50', flex: 1, marginLeft: 10 }]}
            onPress={() => {
              if (currentLearnIndex < learnArtworks.length - 1) {
                setImageLoading(true);
                setShowNoteInLearn(false);
                setCurrentLearnIndex(currentLearnIndex + 1);
              } else {
                // Poslední dílo - vrátit se na začátek nebo home
                setScreen('home');
                setLearnArtworks([]);
                setCurrentLearnIndex(0);
                setShowNoteInLearn(false);
              }
            }}
          >
            <Text style={styles.learnButtonText} numberOfLines={1}>DALŠÍ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Kvízová obrazovka
  if (screen === 'quiz' && currentArtwork) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.scoreHeader}>
          <View style={styles.scoreRow}>
            {/* Round */}
            <Text style={styles.scoreText}>
              {currentRound}/{selectedRounds}
            </Text>
            
            {/* Title */}
            {selectedCategories.title && (
              <>
                <View style={styles.scoreDivider} />
                <Ionicons name="image-outline" size={18} color="#666" style={styles.scoreIcon} />
                <Text style={[
                  styles.scoreText,
                  { color: 
                    !showAnswer && currentRound === 1 ? '#333' : 
                    scores.titles === currentRound ? '#4CAF50' : 
                    scores.titles === 0 ? '#F44336' : '#333' 
                  }
                ]}>
                  {scores.titles}
                </Text>
              </>
            )}
            
            {/* Author */}
            {selectedCategories.author && (
              <>
                <View style={styles.scoreDivider} />
                <Ionicons name="person-outline" size={18} color="#666" style={styles.scoreIcon} />
                <Text style={[
                  styles.scoreText,
                  { color: 
                    !showAnswer && currentRound === 1 ? '#333' : 
                    scores.authors === currentRound ? '#4CAF50' : 
                    scores.authors === 0 ? '#F44336' : '#333' 
                  }
                ]}>
                  {scores.authors}
                </Text>
              </>
            )}
            
            {/* Year */}
            {selectedCategories.year && (
              <>
                <View style={styles.scoreDivider} />
                <Ionicons name="calendar-outline" size={18} color="#666" style={styles.scoreIcon} />
                <Text style={[
                  styles.scoreText,
                  { color: 
                    !showAnswer && currentRound === 1 && scores.years === 0 ? '#333' :
                    scores.years === 0 ? '#4CAF50' : '#F44336' 
                  }
                ]}>
                  {scores.years}
                </Text>
              </>
            )}
          </View>
        </View>

        {imageLoading && (
          <View style={styles.imageLoader}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        )}
        <TouchableOpacity onPress={() => setImageZoomVisible(true)}>
          <Image
            source={{ uri: currentArtwork.picture }}
            style={[
              styles.artworkImage,
              {
                height: showAnswer ? 
                  (Object.values(selectedCategories).filter(Boolean).length === 1 ? 480 :
                   Object.values(selectedCategories).filter(Boolean).length === 2 ? 400 :
                   320) :
                  (Object.values(selectedCategories).filter(Boolean).length === 1 ? 420 :
                   Object.values(selectedCategories).filter(Boolean).length === 2 ? 350 :
                   280)
              }
            ]}
            resizeMode="contain"
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
          />
        </TouchableOpacity>

        {/* Modal pro přiblížení obrázku */}
        <Modal
          visible={imageZoomVisible}
          transparent={true}
          onRequestClose={() => {
            setImageZoomVisible(false);
            setZoomLevel(1);
          }}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => {
                setImageZoomVisible(false);
                setZoomLevel(1);
              }}
            >
              <Ionicons name="close-circle" size={40} color="#fff" />
            </TouchableOpacity>
            
            {/* Zoom controls */}
            <View style={styles.zoomControls}>
              <TouchableOpacity 
                style={styles.zoomButton}
                onPress={() => setZoomLevel(prev => Math.min(prev + 0.5, 3))}
              >
                <Ionicons name="add-circle" size={40} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.zoomLevelText}>{Math.round(zoomLevel * 100)}%</Text>
              <TouchableOpacity 
                style={styles.zoomButton}
                onPress={() => setZoomLevel(prev => Math.max(prev - 0.5, 1))}
              >
                <Ionicons name="remove-circle" size={40} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView
              contentContainerStyle={styles.zoomScrollContent}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: currentArtwork.picture }}
                style={[
                  styles.zoomedImage,
                  { 
                    transform: [{ scale: zoomLevel }],
                  }
                ]}
                resizeMode="contain"
              />
            </ScrollView>
          </View>
        </Modal>

        {!showAnswer ? (
          <View style={styles.inputContainer}>
            {selectedCategories.title && (
              <View style={styles.inputRow}>
                <Ionicons name="image-outline" size={24} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={titleInput}
                  onChangeText={setTitleInput}
                  placeholder="Název díla"
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    if (selectedCategories.author && authorInputRef.current) {
                      authorInputRef.current.focus();
                    } else if (selectedCategories.year && yearInputRef.current) {
                      yearInputRef.current.focus();
                    }
                  }}
                />
              </View>
            )}

            {selectedCategories.author && (
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={24} color="#666" style={styles.inputIcon} />
                <TextInput
                  ref={authorInputRef}
                  style={styles.input}
                  value={authorInput}
                  onChangeText={setAuthorInput}
                  placeholder="Autor"
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    if (selectedCategories.year && yearInputRef.current) {
                      yearInputRef.current.focus();
                    }
                  }}
                />
              </View>
            )}

            {selectedCategories.year && (
              <View style={styles.inputRow}>
                <Ionicons name="calendar-outline" size={24} color="#666" style={styles.inputIcon} />
                <TextInput
                  ref={yearInputRef}
                  style={styles.input}
                  value={yearInput}
                  onChangeText={setYearInput}
                  placeholder="Rok"
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
            )}

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>POTVRDIT</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.answerContainer}>
            {/* Title */}
            {selectedCategories.title && (
              <View style={styles.answerItem}>
                <TouchableOpacity 
                  style={styles.answerItemHeader}
                  onPress={() => setShowUserAnswers(prev => ({ ...prev, title: !prev.title }))}
                >
                  <View style={styles.answerItemLeft}>
                    <Ionicons name="image-outline" size={20} color="#666" style={styles.answerIcon} />
                    <Text style={styles.answerItemText}>{isEnglish ? currentArtwork.title_en : currentArtwork.title}</Text>
                  </View>
                  <View style={styles.answerItemRight}>
                    <Ionicons 
                      name={titleInput.trim() && wordsMatch(titleInput.trim(), isEnglish ? currentArtwork.title_en : currentArtwork.title) 
                        ? "checkmark-circle" 
                        : "close-circle"
                      } 
                      size={20} 
                      color={titleInput.trim() && wordsMatch(titleInput.trim(), isEnglish ? currentArtwork.title_en : currentArtwork.title) 
                        ? "#4CAF50" 
                        : "#F44336"
                      } 
                    />
                    <Text style={styles.answerToggleIcon}>
                      {showUserAnswers.title ? '▼' : '▶'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {showUserAnswers.title && (
                  <View style={styles.answerItemContent}>
                    <Text style={styles.userAnswerText}>{titleInput || '-'}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Author */}
            {selectedCategories.author && (
              <View style={styles.answerItem}>
                <TouchableOpacity 
                  style={styles.answerItemHeader}
                  onPress={() => setShowUserAnswers(prev => ({ ...prev, author: !prev.author }))}
                >
                  <View style={styles.answerItemLeft}>
                    <Ionicons name="person-outline" size={20} color="#666" style={styles.answerIcon} />
                    <Text style={styles.answerItemText}>{isEnglish ? currentArtwork.author_en : currentArtwork.author}</Text>
                  </View>
                  <View style={styles.answerItemRight}>
                    <Ionicons 
                      name={authorInput.trim() && wordsMatch(authorInput.trim(), isEnglish ? currentArtwork.author_en : currentArtwork.author) 
                        ? "checkmark-circle" 
                        : "close-circle"
                      } 
                      size={20} 
                      color={authorInput.trim() && wordsMatch(authorInput.trim(), isEnglish ? currentArtwork.author_en : currentArtwork.author) 
                        ? "#4CAF50" 
                        : "#F44336"
                      } 
                    />
                    <Text style={styles.answerToggleIcon}>
                      {showUserAnswers.author ? '▼' : '▶'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {showUserAnswers.author && (
                  <View style={styles.answerItemContent}>
                    <Text style={styles.userAnswerText}>{authorInput || '-'}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Year */}
            {selectedCategories.year && (
              <View style={styles.answerItem}>
                <TouchableOpacity 
                  style={styles.answerItemHeader}
                  onPress={() => setShowUserAnswers(prev => ({ ...prev, year: !prev.year }))}
                >
                  <View style={styles.answerItemLeft}>
                    <Ionicons name="calendar-outline" size={20} color="#666" style={styles.answerIcon} />
                    <Text style={styles.answerItemText}>
                      {currentArtwork.year_start === currentArtwork.year_end 
                        ? currentArtwork.year_start 
                        : `${currentArtwork.year_start}-${currentArtwork.year_end}`}
                    </Text>
                  </View>
                  <View style={styles.answerItemRight}>
                    {currentYearDiff ? (
                      <Text style={styles.yearDiffText}>({currentYearDiff.replace('penalty: ', '')})</Text>
                    ) : (
                      <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    )}
                    <Text style={styles.answerToggleIcon}>
                      {showUserAnswers.year ? '▼' : '▶'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {showUserAnswers.year && (
                  <View style={styles.answerItemContent}>
                    <Text style={styles.userAnswerText}>{yearInput || '-'}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Info button */}
            <TouchableOpacity 
              style={styles.infoButton}
              onPress={() => setShowNoteInQuiz(!showNoteInQuiz)}
            >
              <Ionicons name="information-circle-outline" size={24} color="#2196F3" />
              <Text style={styles.infoButtonText}>Info</Text>
            </TouchableOpacity>

            {/* Note */}
            {showNoteInQuiz && (
              <View style={styles.noteContainer}>
                <Text style={styles.noteText}>{isEnglish ? currentArtwork.note_en : currentArtwork.note}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>DALŠÍ</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Výsledková obrazovka
  if (screen === 'results') {
    // Výpočet procent
    const percentages = [];
    let totalPercentage = 0;
    let activeCategories = 0;

    // Díla
    let titlesPercent = 0;
    if (selectedCategories.title) {
      titlesPercent = Math.round((scores.titles / selectedRounds) * 100);
      percentages.push(titlesPercent);
      totalPercentage += titlesPercent;
      activeCategories++;
    }

    // Autoři
    let authorsPercent = 0;
    if (selectedCategories.author) {
      authorsPercent = Math.round((scores.authors / selectedRounds) * 100);
      percentages.push(authorsPercent);
      totalPercentage += authorsPercent;
      activeCategories++;
    }

    // Roky - exponenciální funkce
    let yearsPercent = 0;
    if (selectedCategories.year) {
      const avgError = scores.years / selectedRounds;
      if (avgError >= 500) {
        yearsPercent = 0;
      } else {
        const k = 0.01;
        yearsPercent = Math.round(100 * Math.exp(-k * avgError));
      }
      percentages.push(yearsPercent);
      totalPercentage += yearsPercent;
      activeCategories++;
    }

    const overallPercent = activeCategories > 0 ? Math.round(totalPercentage / activeCategories) : 0;

    // Hodnocení podle procent
    let evaluationText = '';
    let evaluationImage = null;
    
    if (overallPercent >= 95) {
      evaluationText = 'Dotkl/a ses geniality!';
      evaluationImage = require('./pictures/95.jpg');
    } else if (overallPercent >= 90) {
      evaluationText = 'Transcendentní výkon.';
      evaluationImage = require('./pictures/90.jpg');
    } else if (overallPercent >= 80) {
      evaluationText = 'Sebevědomý postup vpřed.';
      evaluationImage = require('./pictures/80.jpg');
    } else if (overallPercent >= 65) {
      evaluationText = 'Roztočil/a jsi to pěkně.';
      evaluationImage = require('./pictures/65.jpg');
    } else if (overallPercent >= 50) {
      evaluationText = 'Hmm... něco tam je.';
      evaluationImage = require('./pictures/50.jpg');
    } else if (overallPercent >= 40) {
      evaluationText = 'Některé otázky zabolely.';
      evaluationImage = require('./pictures/40.jpg');
    } else if (overallPercent >= 30) {
      evaluationText = 'Test tě trochu pohltil.';
      evaluationImage = require('./pictures/30.jpg');
    } else if (overallPercent >= 20) {
      evaluationText = 'Trochu ses ztratil/a.';
      evaluationImage = require('./pictures/20.jpg');
    } else {
      evaluationText = 'Koncept byl odvážný.';
      evaluationImage = require('./pictures/0.jpg');
    }

    return (
      <View style={styles.container}>
        <Text style={styles.resultsTitle}>Tvoje skóre:</Text>
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>Kola: {selectedRounds}</Text>
          {selectedCategories.title && (
            <Text style={styles.resultsText}>Díla: {scores.titles} ({titlesPercent} %)</Text>
          )}
          {selectedCategories.author && (
            <Text style={styles.resultsText}>Autoři: {scores.authors} ({authorsPercent} %)</Text>
          )}
          {selectedCategories.year && (
            <Text style={styles.resultsText}>Roky (odchylka): {scores.years} ({yearsPercent} %)</Text>
          )}
          <Text style={[styles.resultsText, { fontWeight: 'bold', marginTop: 10 }]}>Celkem: {overallPercent} %</Text>
        </View>

        {/* Hodnocení */}
        <View style={styles.evaluationContainer}>
          <Image 
            source={evaluationImage}
            style={styles.evaluationImage}
            resizeMode="contain"
          />
          <Text style={styles.evaluationText}>{evaluationText}</Text>
        </View>

        <TouchableOpacity style={styles.startButton} onPress={resetQuiz}>
          <Text style={styles.startButtonText}>MENU</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingBottom: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  homeHeader: {
    alignItems: 'flex-end',
    paddingRight: 20,
    paddingTop: 10,
  },
  settingsIcon: {
    padding: 10,
  },
  homeCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeBottom: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  subtitle: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  roundButton: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  roundButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  roundButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  roundButtonTextSelected: {
    color: '#fff',
  },
  categoryButton: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  categoryButtonSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 60,
    borderRadius: 10,
    alignSelf: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scoreHeader: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scoreText: {
    fontSize: 16,
    marginVertical: 2,
    color: '#666',
  },
  artworkImage: {
    width: '90%',
    alignSelf: 'center',
    marginBottom: 15,
    borderRadius: 10,
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
  zoomControls: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  zoomButton: {
    marginHorizontal: 15,
  },
  zoomLevelText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    minWidth: 60,
    textAlign: 'center',
  },
  zoomScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomedImage: {
    width: 380,
    height: 600,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  answerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  scoreDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E0E0E0',
    marginHorizontal: 10,
  },
  scoreIcon: {
    marginRight: 5,
  },
  answerItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  answerItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  answerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  answerItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  answerIcon: {
    marginRight: 10,
  },
  answerItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  answerToggleIcon: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
  },
  answerItemContent: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  yearDiffText: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: '600',
    marginRight: 5,
  },
  userAnswerText: {
    fontSize: 16,
    color: '#666',
  },
  nextButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  settingsButton: {
    backgroundColor: '#757575',
    paddingVertical: 15,
    paddingHorizontal: 60,
    borderRadius: 10,
    alignSelf: 'center',
    marginTop: 20,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  textbookContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  textbookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  textbookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  artworksContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  artworkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  artworkText: {
    fontSize: 14,
    color: '#666',
  },
  settingsButtons: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginTop: 20,
    marginBottom: 40,
  },
  learnImage: {
    width: '90%',
    height: 380,
    alignSelf: 'center',
    marginBottom: 15,
    marginTop: 10,
    borderRadius: 10,
  },
  imageLoader: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    marginLeft: -20,
    zIndex: 1,
  },
  learnInfoContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  learnInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  learnIcon: {
    marginRight: 10,
  },
  learnInfoText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  learnButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
  },
  learnButton: {
    paddingVertical: 15,
    borderRadius: 10,
  },
  learnButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    marginTop: 10,
    color: '#333',
  },
  resultsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    marginBottom: 15,
  },
  resultsText: {
    fontSize: 18,
    marginVertical: 5,
    color: '#333',
    fontWeight: '600',
  },
  evaluationContainer: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 15,
  },
  evaluationImage: {
    width: 250,
    height: 250,
    marginBottom: 10,
  },
  evaluationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
    marginBottom: 10,
  },
  infoButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  noteContainer: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  noteText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});
