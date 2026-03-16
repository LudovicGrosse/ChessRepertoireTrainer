// data.js
export const repertoireDatabase = [
    {
        id: "rep_1",
        title: "Italienne - Attaque Max Lange (Blancs)",
        defaultColor: "white",
        chapters: [
            {
                id: "rep_1_chap_1",
                title: "Max Lange Attack",
                pgn: `[Event "Max Lange Attack"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "White"]
[Black "Black"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d4 exd4 5. O-O Bc5 6. e5 d5 7. exf6 dxc4 8. Re1+ Be6 9. Ng5 Qd5 (9... Qxf6 10. Nxe6 fxe6 11. Qh5+) 10. Nc3 Qf5 11. Nce4 *`
            }
        ]
    },
    {
        id: "rep_2",
        title: "Dfense Sicilienne - Dragon (Noirs)",
        defaultColor: "black",
        chapters: [
            {
                id: "rep_2_chap_1",
                title: "Dragon Variation",
                pgn: `[Event "Dragon Variation"]
1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 *`
            }
        ]
    },
    {
        id: "rep_3",
        title: "Finale de Pions (Position FEN personnalise)",
        defaultColor: "white",
        chapters: [
            {
                id: "rep_3_chap_1",
                title: "Sécuriser le pion passé",
                pgn: `[Event "Sécuriser le pion passé"]\n[FEN "8/8/8/8/4K3/5P2/8/4k3 w - - 0 1"]
1. f4 Kd2 2. f5 *`
            }
        ]
    }
];