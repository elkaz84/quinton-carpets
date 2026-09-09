/**
 * Twelve real reviews, copied verbatim from Google, Yell, Facebook
 * and Yelp with the name and the source.
 *
 * DO NOT invent, edit, shorten, reorder for effect or add to this
 * list. Phase two replaces it with the live Google Business Profile
 * feed; until then there is no AggregateRating in the structured
 * data, because these are not yet machine-verifiable.
 */

export type Quote = { t: string; n: string; s: string };

export const QUOTES: Quote[] = [
  { t: "Best carpet shop I've ever been to. Amazing staff very polite, well mannered and helpful.", n: "Millsy 1976", s: "Google" },
  { t: "Very pleased with the professional service we received from Aman and staff - Quinton Carpets.", n: "Deborah Checkley", s: "Google" },
  { t: "Great place best service we have had carpet fitted looks amazing. Brilliant work.", n: "Tracey Brookes", s: "Google" },
  { t: "I received a first class service and a quality product at an excellent price from Quinton Carpets.", n: "MartinW-577", s: "Yell" },
  { t: "Another good job done by Aman & his team nothing too much trouble for them very reliable", n: "Tracy Joyner", s: "Google" },
  { t: "Excellent customer service again. Reasonable price. Convenient appointment made for fitting.", n: "Pat Seddon", s: "Google" },
  { t: "Really friendly service, good prices and fitting service. Good to see a great local business", n: "ElaineQuinton", s: "Yell" },
  { t: "Thanks lads Great job!! supplied and fitted our stair and hallway carpet", n: "Steve Castle", s: "Google" },
  { t: "Good quality carpet at a very reasonable price. Fantastic service, very helpful", n: "Ann Marie Woodall", s: "Facebook" },
  { t: "Great customer service Great advise and don't charge an arm and leg", n: "Leanne O'Condell", s: "Google" },
  { t: "You was very efficient in your work and didn't leave till it was 100%", n: "Victoria Stokes", s: "Facebook" },
  { t: "Excellent service very quick and expertly fitted bedroom carpet", n: "Karen Griffiths", s: "Google" },
];
