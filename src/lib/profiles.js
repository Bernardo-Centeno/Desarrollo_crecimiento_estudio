// Perfiles de estudio: cada materia se clasifica en un tipo y de ahí salen
// las técnicas recomendadas, la duración de las sesiones y los repasos.

export const SUBJECT_TYPES = {
    memoria: {
      label: 'Memorística',
      short: 'Memoria',
      description: 'Mucho contenido para recordar: definiciones, leyes, fechas, anatomía, vocabulario técnico.',
      examples: 'Derecho, anatomía, historia, farmacología',
      studyMinutes: 45,
      reviewMinutes: 20,
      reviewOffsets: [1, 3, 7, 14],
      techniques: [
        { name: 'Repetición espaciada', tip: 'Repasá el tema al día siguiente, a los 3, 7 y 14 días. Es lo que más ayuda a que no se olvide.' },
        { name: 'Recuerdo activo', tip: 'Cerrá el material y escribí o decí todo lo que recuerdes. Después compará con los apuntes.' },
        { name: 'Flashcards', tip: 'Armá tarjetas de pregunta y respuesta con lo que más te cuesta recordar.' },
      ],
    },
    problemas: {
      label: 'Resolución de problemas',
      short: 'Problemas',
      description: 'Se aprende haciendo ejercicios: matemática, contabilidad, física, programación, estadística.',
      examples: 'Análisis matemático, contabilidad, física, programación',
      studyMinutes: 60,
      reviewMinutes: 30,
      reviewOffsets: [2, 7, 14],
      techniques: [
        { name: 'Práctica intercalada', tip: 'Mezclá distintos tipos de ejercicios en la misma sesión en vez de repetir siempre el mismo.' },
        { name: 'Resolver sin mirar', tip: 'Intentá cada ejercicio solo antes de ver la solución. Si te trabás, anotá en qué paso.' },
        { name: 'Cuaderno de errores', tip: 'Anotá los errores que cometés. Repasalos antes del examen, valen más que releer teoría.' },
      ],
    },
    teoria: {
      label: 'Comprensión y teoría',
      short: 'Teoría',
      description: 'Hay que entender ideas y relacionarlas: filosofía, economía, psicología, sociología.',
      examples: 'Filosofía, economía, psicología, sociología',
      studyMinutes: 50,
      reviewMinutes: 25,
      reviewOffsets: [2, 7, 14],
      techniques: [
        { name: 'Técnica Feynman', tip: 'Explicá el tema en voz alta con palabras simples, como si se lo enseñaras a alguien. Donde te trabás, ahí hay que reforzar.' },
        { name: 'Mapas conceptuales', tip: 'Dibujá cómo se relacionan los conceptos entre sí en una hoja.' },
        { name: 'Preguntas propias', tip: 'Escribí preguntas de examen sobre el tema y respondelas sin mirar.' },
      ],
    },
    idiomas: {
      label: 'Idiomas',
      short: 'Idiomas',
      description: 'Vocabulario, gramática y práctica: inglés, portugués, italiano, etc.',
      examples: 'Inglés, portugués, italiano, alemán',
      studyMinutes: 30,
      reviewMinutes: 15,
      reviewOffsets: [1, 3, 7, 14],
      techniques: [
        { name: 'Repetición espaciada', tip: 'Repasá el vocabulario nuevo a los 1, 3, 7 y 14 días.' },
        { name: 'Práctica activa', tip: 'Usá lo aprendido: escribí frases, hablá solo en voz alta o grabate.' },
        { name: 'Sesiones cortas y frecuentes', tip: 'Es mejor 30 minutos casi todos los días que 3 horas un solo día.' },
      ],
    },
  };
  
  export const TYPE_KEYS = Object.keys(SUBJECT_TYPES);
  
  // Sugiere un tipo según el nombre de la materia (el usuario lo puede cambiar)
  const KEYWORDS = {
    idiomas: ['ingles', 'inglés', 'portugues', 'portugués', 'italiano', 'frances', 'francés', 'aleman', 'alemán', 'idioma', 'english', 'japones', 'japonés', 'chino'],
    problemas: ['matematica', 'matemática', 'analisis', 'análisis', 'algebra', 'álgebra', 'calculo', 'cálculo', 'fisica', 'física', 'quimica', 'química', 'estadistica', 'estadística', 'contabilidad', 'programacion', 'programación', 'algoritmo', 'informatica', 'informática', 'probabilidad', 'costos', 'finanzas', 'electronica', 'electrónica', 'mecanica', 'mecánica'],
    memoria: ['anatomia', 'anatomía', 'derecho', 'historia', 'farmacologia', 'farmacología', 'fisiologia', 'fisiología', 'biologia', 'biología', 'histologia', 'histología', 'patologia', 'patología', 'medicina', 'geografia', 'geografía', 'penal', 'civil', 'laboral', 'constitucional', 'botanica', 'botánica', 'zoologia', 'zoología', 'microbiologia', 'microbiología', 'bioquimica', 'bioquímica'],
    teoria: ['filosofia', 'filosofía', 'economia', 'economía', 'psicologia', 'psicología', 'sociologia', 'sociología', 'politica', 'política', 'literatura', 'comunicacion', 'comunicación', 'pedagogia', 'pedagogía', 'antropologia', 'antropología', 'administracion', 'administración', 'marketing'],
  };
  
  export function guessType(name) {
    const n = name.toLowerCase();
    for (const type of ['idiomas', 'problemas', 'memoria', 'teoria']) {
      if (KEYWORDS[type].some((k) => n.includes(k))) return type;
    }
    return 'teoria';
  }
  
  export function typeLabel(type) {
    return SUBJECT_TYPES[type]?.label ?? type;
  }