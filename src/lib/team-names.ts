// מיפוי שמות קבוצות מדורגות: אנגלית (matches.home_team_name / away_team_name)
// → עברית (bonus_questions.options / bonus_picks.pick)
export const ENGLISH_TO_HEBREW_TEAM: Record<string, string> = {
  // דרג א'
  England: 'אנגליה',
  Argentina: 'ארגנטינה',
  USA: 'ארצות הברית',
  Belgium: 'בלגיה',
  Brazil: 'ברזיל',
  Germany: 'גרמניה',
  Netherlands: 'הולנד',
  Mexico: 'מקסיקו',
  Spain: 'ספרד',
  Portugal: 'פורטוגל',
  France: 'צרפת',
  Canada: 'קנדה',

  // דרג ב'
  Austria: 'אוסטריה',
  Australia: 'אוסטרליה',
  Uruguay: 'אורוגוואי',
  Iran: 'איראן',
  Ecuador: 'אקוודור',
  'South Korea': 'דרום קוריאה',
  Japan: 'יפן',
  Morocco: 'מרוקו',
  Senegal: 'סנגל',
  Colombia: 'קולומביה',
  Croatia: 'קרואטיה',
  Switzerland: 'שווייץ',

  // דרג ג'
  Uzbekistan: 'אוזבקיסטן',
  Algeria: "אלג'יריה",
  'South Africa': 'דרום אפריקה',
  'Ivory Coast': 'חוף השנהב',
  Egypt: 'מצרים',
  Norway: 'נורווגיה',
  Scotland: 'סקוטלנד',
  'Saudi Arabia': 'ערב הסעודית',
  Panama: 'פנמה',
  Paraguay: 'פרגוואי',
  Qatar: 'קטאר',
  Tunisia: 'תוניסיה',

  // דרג ד'
  'Bosnia & Herzegovina': 'בוסניה והרצגובינה',
  Ghana: 'גאנה',
  Haiti: 'האיטי',
  Türkiye: 'טורקיה',
  Jordan: 'ירדן',
  'Cape Verde Islands': 'כף ורדה',
  'New Zealand': 'ניו זילנד',
  Iraq: 'עיראק',
  'Czech Republic': "צ'כיה",
  Curaçao: 'קוראסאו',
  'Congo DR': 'קונגו',
  Sweden: 'שבדיה',
}
