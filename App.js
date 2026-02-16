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

// Otevření databáze
const db = SQLite.openDatabaseSync('artworks.db');

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
  const [screen, setScreen] = useState('home'); // 'home', 'quiz', 'results'
  const [selectedRounds, setSelectedRounds] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState({
    title: true,
    author: true,
    year: true,
  });
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

  const initDatabase = async () => {
    try {
      // Vytvoření tabulky
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS artworks (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          year_start INTEGER NOT NULL,
          year_end INTEGER NOT NULL,
          picture TEXT NOT NULL
        );
      `);

      // Kontrola, zda je databáze prázdná
      const result = await db.getAllAsync('SELECT COUNT(*) as count FROM artworks');
      
      if (result[0].count === 0) {
        // Vložení počátečních dat
        await db.runAsync(
          `INSERT INTO artworks (id, title, author, year_start, year_end, picture) VALUES 
          (1, 'Portrét Arnolfiniho', 'Jan van Eyck', 1434, 1434, 'https://github.com/4Tomek/art_images/releases/download/v1.0/portret_arnolfiniho.jpg'),
          (2, 'Zrození Venuše', 'Sandro Botticelli', 1484, 1486, 'https://github.com/4Tomek/art_images/releases/download/v1.0/zrozeni_venuse.jpg'),
          (3, 'Mona Lisa', 'Leonardo da Vinci', 1503, 1506, 'https://github.com/4Tomek/art_images/releases/download/v1.0/mona_lisa.jpg'),
          (4, 'Dívka s perlou', 'Johannes Vermeer', 1665, 1665, 'https://github.com/4Tomek/art_images/releases/download/v1.0/divka_s_perlou.jpg'),
          (5, 'Hvězdná noc', 'Vincent van Gogh', 1889, 1889, 'https://github.com/4Tomek/art_images/releases/download/v1.0/hvezdna_noc.jpg'),
          (6, 'Výkřik', 'Edvard Munch', 1893, 1893, 'https://github.com/4Tomek/art_images/releases/download/v1.0/vykrik.jpg'),
          (7, 'Kompozice A', 'Piet Mondrian', 1920, 1920, 'https://github.com/4Tomek/art_images/releases/download/v1.0/composition_a.jpg')`
        );
        console.log('Data byla vložena do databáze');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Chyba při inicializaci databáze:', error);
      Alert.alert('Chyba', 'Nepodařilo se inicializovat databázi');
      setLoading(false);
    }
  };

  const startQuiz = async () => {
    setScreen('quiz');
    setCurrentRound(1);
    setUsedIds([]);
    setScores({ titles: 0, authors: 0, years: 0 });
    await loadRandomArtwork([]);
  };

  const loadRandomArtwork = async (excludeIds) => {
    try {
      // Získání všech ID kromě již použitých
      const placeholders = excludeIds.length > 0 ? excludeIds.map(() => '?').join(',') : '';
      const query = excludeIds.length > 0 
        ? `SELECT * FROM artworks WHERE id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`
        : 'SELECT * FROM artworks ORDER BY RANDOM() LIMIT 1';
      
      const result = await db.getAllAsync(query, excludeIds);
      
      if (result.length > 0) {
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
        newShowUserAnswers.title = true; // Špatná = rozbaleno
      }
    }

    // Vyhodnocení author - alespoň 1 slovo (min 3 znaky) se musí shodovat
    if (selectedCategories.author) {
      const isCorrect = authorInput.trim() && wordsMatch(authorInput.trim(), currentArtwork.author);
      if (isCorrect) {
        newScores.authors += 1;
        newShowUserAnswers.author = false; // Správná = sbaleno
      } else {
        newShowUserAnswers.author = true; // Špatná = rozbaleno
      }
    }

    // Vyhodnocení year
    if (selectedCategories.year) {
      const year = parseInt(yearInput.trim());
      if (yearInput.trim() === '' || isNaN(year)) {
        // Penalizace za nevyplnění nebo neplatné číslo
        newScores.years += 500;
        yearDiff = 'penalty: +500';
        newShowUserAnswers.year = true; // Špatná = rozbaleno
      } else {
        if (year < currentArtwork.year_start) {
          const diff = currentArtwork.year_start - year;
          newScores.years += diff;
          yearDiff = `+${diff}`;
          newShowUserAnswers.year = true; // Špatná = rozbaleno
        } else if (year > currentArtwork.year_end) {
          const diff = year - currentArtwork.year_end;
          newScores.years += diff;
          yearDiff = `+${diff}`;
          newShowUserAnswers.year = true; // Špatná = rozbaleno
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
    setSelectedRounds(1);
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
        <Text style={styles.title}>Kvíz uměleckých děl</Text>
        
        <Text style={styles.subtitle}>Vyber kategorie:</Text>
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
              Title
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
              Author
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
              Year
            </Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.subtitle}>Vyber počet kol:</Text>
        <View style={styles.buttonGroup}>
          {[1, 3, 7].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.roundButton,
                selectedRounds === num && styles.roundButtonSelected,
              ]}
              onPress={() => setSelectedRounds(num)}
            >
              <Text
                style={[
                  styles.roundButtonText,
                  selectedRounds === num && styles.roundButtonTextSelected,
                ]}
              >
                {num} {num === 1 ? 'round' : 'rounds'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.startButton} onPress={startQuiz}>
          <Text style={styles.startButtonText}>START</Text>
        </TouchableOpacity>
      </View>
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

        <TouchableOpacity onPress={() => setImageZoomVisible(true)}>
          <Image
            source={{ uri: currentArtwork.picture }}
            style={[
              styles.artworkImage,
              {
                height: 
                  Object.values(selectedCategories).filter(Boolean).length === 1 ? 420 :
                  Object.values(selectedCategories).filter(Boolean).length === 2 ? 350 :
                  280
              }
            ]}
            resizeMode="contain"
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
              <Text style={styles.submitButtonText}>SUBMIT</Text>
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
                    <Text style={styles.answerItemText}>{currentArtwork.title}</Text>
                  </View>
                  <View style={styles.answerItemRight}>
                    <Ionicons 
                      name={titleInput.trim() && wordsMatch(titleInput.trim(), currentArtwork.title) 
                        ? "checkmark-circle" 
                        : "close-circle"
                      } 
                      size={20} 
                      color={titleInput.trim() && wordsMatch(titleInput.trim(), currentArtwork.title) 
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
                    <Text style={styles.answerItemText}>{currentArtwork.author}</Text>
                  </View>
                  <View style={styles.answerItemRight}>
                    <Ionicons 
                      name={authorInput.trim() && wordsMatch(authorInput.trim(), currentArtwork.author) 
                        ? "checkmark-circle" 
                        : "close-circle"
                      } 
                      size={20} 
                      color={authorInput.trim() && wordsMatch(authorInput.trim(), currentArtwork.author) 
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

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>NEXT</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Výsledková obrazovka
  if (screen === 'results') {
    return (
      <View style={styles.container}>
        <Text style={styles.resultsTitle}>Tvoje skóre:</Text>
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>Rounds: {selectedRounds}</Text>
          {selectedCategories.title && (
            <Text style={styles.resultsText}>Titles: {scores.titles}</Text>
          )}
          {selectedCategories.author && (
            <Text style={styles.resultsText}>Authors: {scores.authors}</Text>
          )}
          {selectedCategories.year && (
            <Text style={styles.resultsText}>Years: {scores.years}</Text>
          )}
        </View>

        <TouchableOpacity style={styles.startButton} onPress={resetQuiz}>
          <Text style={styles.startButtonText}>NOVÁ HRA</Text>
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
    fontSize: 16,
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
    fontSize: 16,
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
    color: '#333',
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
  resultsTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  resultsContainer: {
    backgroundColor: '#fff',
    padding: 30,
    marginHorizontal: 20,
    borderRadius: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    marginBottom: 40,
  },
  resultsText: {
    fontSize: 24,
    marginVertical: 10,
    color: '#333',
    fontWeight: '600',
  },
});
