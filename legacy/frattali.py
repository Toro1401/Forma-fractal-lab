"""
Laboratorio Frattali Interattivo (Python + Tkinter)
Trascina i vertici del segmento base con il mouse e guarda il frattale esplodere.
"""

import tkinter as tk
from tkinter import ttk
import math

class FractalApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Frattale Esplosivo - Polyline Generator")
        self.root.geometry("1100x720")
        self.root.configure(bg="#12161f")

        # Punti di piegamento (u, v normalizzati: 0 <= u <= 1)
        # Default: 1 punto (duplica a ogni iterazione: 2^N)
        self.folds = [{"u": 0.5, "v": 0.5}]
        self.iterations = 4
        self.drag_idx = None

        self.setup_ui()
        self.draw_generator()
        self.draw_fractal()

    def setup_ui(self):
        # Pannello laterale sinistro
        sidebar = tk.Frame(self.root, bg="#1a202c", width=340, padx=15, pady=15)
        sidebar.pack(side=tk.LEFT, fill=tk.Y)
        sidebar.pack_propagate(False)

        title = tk.Label(sidebar, text="Laboratorio Frattali", font=("Helvetica", 14, "bold"), fg="#63b3ed", bg="#1a202c")
        title.pack(anchor="w", pady=(0, 10))

        # 1. Editor del Segmento
        lbl_gen = tk.Label(sidebar, text="1. Editor del Segmento Base", font=("Helvetica", 10, "bold"), fg="#fff", bg="#1a202c")
        lbl_gen.pack(anchor="w")
        hint_gen = tk.Label(sidebar, text="Trascina i nodi azzurri con il mouse.\nClicca sulla riga per aggiungere pieghe.", 
                            font=("Helvetica", 8), fg="#a0aec0", bg="#1a202c", justify=tk.LEFT)
        hint_gen.pack(anchor="w", pady=(0, 6))

        self.gen_canvas = tk.Canvas(sidebar, width=300, height=140, bg="#0d1117", highlightthickness=1, highlightbackground="#2d3748")
        self.gen_canvas.pack(pady=4)
        self.gen_canvas.bind("<Button-1>", self.on_gen_press)
        self.gen_canvas.bind("<B1-Motion>", self.on_gen_drag)
        self.gen_canvas.bind("<ButtonRelease-1>", self.on_gen_release)
        self.gen_canvas.bind("<Button-3>", self.on_gen_right_click) # Tasto destro per rimuovere

        btn_box = tk.Frame(sidebar, bg="#1a202c")
        btn_box.pack(fill=tk.X, pady=6)
        tk.Button(btn_box, text="+ Aggiungi Piega", command=self.add_fold, bg="#2d3748", fg="#fff", relief=tk.FLAT).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=2)
        tk.Button(btn_box, text="- Rimuovi", command=self.remove_fold, bg="#2d3748", fg="#fff", relief=tk.FLAT).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=2)

        # 2. Controllo Iterazioni
        tk.Label(sidebar, text="2. Numero di Iterazioni", font=("Helvetica", 10, "bold"), fg="#fff", bg="#1a202c").pack(anchor="w", pady=(15, 2))
        self.iter_label = tk.Label(sidebar, text=f"Iterazioni: {self.iterations}", fg="#e2e8f0", bg="#1a202c")
        self.iter_label.pack(anchor="w")

        self.iter_slider = tk.Scale(sidebar, from_=0, to=8, orient=tk.HORIZONTAL, bg="#1a202c", fg="#fff", 
                                    troughcolor="#2d3748", highlightthickness=0, command=self.on_slider_change)
        self.iter_slider.set(self.iterations)
        self.iter_slider.pack(fill=tk.X)

        # 3. Preset
        tk.Label(sidebar, text="3. Preset Preconfigurati", font=("Helvetica", 10, "bold"), fg="#fff", bg="#1a202c").pack(anchor="w", pady=(15, 2))
        presets = [
            ("Lévy C Curve (1 piega, x2)", self.preset_levy),
            ("Picco Triangolare (1 piega, x2)", self.preset_tent),
            ("Doppia Onda Z (2 pieghe, x3)", self.preset_z),
            ("Curva di Koch (3 pieghe, x4)", self.preset_koch),
        ]
        for name, cmd in presets:
            tk.Button(sidebar, text=name, command=cmd, bg="#2d3748", fg="#e2e8f0", anchor="w", relief=tk.FLAT).pack(fill=tk.X, pady=2)

        # Statistiche dinamiche
        self.stats_var = tk.StringVar()
        stats_box = tk.Label(sidebar, textvariable=self.stats_var, font=("Courier", 9), fg="#68d391", bg="#0f2417",
                             justify=tk.LEFT, relief=tk.RIDGE, padx=8, pady=8)
        stats_box.pack(fill=tk.X, pady=(20, 0))
        self.update_stats()

        # Canvas principale del Frattale
        self.fractal_canvas = tk.Canvas(self.root, bg="#0a0d14", highlightthickness=0)
        self.fractal_canvas.pack(side=tk.RIGHT, expand=True, fill=tk.BOTH)
        self.fractal_canvas.bind("<Configure>", lambda e: self.draw_fractal())

    def update_stats(self):
        K = len(self.folds)
        mult = K + 1
        total_segs = mult ** self.iterations
        self.stats_var.set(
            f"Punti di piega: {K}\n"
            f"Moltiplicatore: x{mult} / iterazione\n"
            f"Segmenti attuali: {total_segs:,}"
        )

    # --- COORDINATE GENERATORE ---
    def gen_to_screen(self, u, v):
        pad = 30
        w = 300 - 2 * pad
        h = 140
        x = pad + u * w
        y = h / 2 - v * w
        return x, y

    def screen_to_gen(self, x, y):
        pad = 30
        w = 300 - 2 * pad
        h = 140
        u = (x - pad) / w
        v = (h / 2 - y) / w
        return u, v

    def draw_generator(self):
        self.gen_canvas.delete("all")
        p0_x, p0_y = self.gen_to_screen(0, 0)
        p1_x, p1_y = self.gen_to_screen(1, 0)

        # Linea guida orizzontale tratteggiata
        self.gen_canvas.create_line(p0_x, p0_y, p1_x, p1_y, fill="#4a5568", dash=(3, 3))

        # Punti del generatore
        pts = [(0, 0)] + [(f["u"], f["v"]) for f in self.folds] + [(1, 0)]
        screen_pts = [self.gen_to_screen(u, v) for u, v in pts]

        # Traccia segmenti
        for i in range(len(screen_pts) - 1):
            x1, y1 = screen_pts[i]
            x2, y2 = screen_pts[i+1]
            self.gen_canvas.create_line(x1, y1, x2, y2, fill="#4299e1", width=2)

        # Disegna cerchietti vertici
        for i, (x, y) in enumerate(screen_pts):
            r = 3 if (i == 0 or i == len(screen_pts) - 1) else 6
            color = "#a0aec0" if (i == 0 or i == len(screen_pts) - 1) else "#63b3ed"
            self.gen_canvas.create_oval(x - r, y - r, x + r, y + r, fill=color, outline="#fff")

    def on_gen_press(self, event):
        self.drag_idx = None
        for idx, f in enumerate(self.folds):
            sx, sy = self.gen_to_screen(f["u"], f["v"])
            if math.hypot(sx - event.x, sy - event.y) < 10:
                self.drag_idx = idx
                return

        # Se clicco lontano, aggiungo una piega lì
        u, v = self.screen_to_gen(event.x, event.y)
        if 0.05 < u < 0.95:
            self.folds.append({"u": u, "v": v})
            self.folds.sort(key=lambda item: item["u"])
            self.drag_idx = next(i for i, f in enumerate(self.folds) if f["u"] == u)
            self.draw_generator()
            self.draw_fractal()

    def on_gen_drag(self, event):
        if self.drag_idx is not None:
            u, v = self.screen_to_gen(event.x, event.y)
            self.folds[self.drag_idx]["u"] = max(0.02, min(0.98, u))
            self.folds[self.drag_idx]["v"] = v
            self.draw_generator()
            self.draw_fractal()

    def on_gen_release(self, event):
        if self.drag_idx is not None:
            self.folds.sort(key=lambda item: item["u"])
            self.drag_idx = None
            self.draw_generator()
            self.draw_fractal()

    def on_gen_right_click(self, event):
        if len(self.folds) <= 1:
            return
        for idx, f in enumerate(self.folds):
            sx, sy = self.gen_to_screen(f["u"], f["v"])
            if math.hypot(sx - event.x, sy - event.y) < 10:
                self.folds.pop(idx)
                self.draw_generator()
                self.draw_fractal()
                return

    def add_fold(self):
        self.folds.append({"u": 0.5, "v": 0.4})
        self.folds.sort(key=lambda item: item["u"])
        self.draw_generator()
        self.draw_fractal()

    def remove_fold(self):
        if len(self.folds) > 1:
            self.folds.pop()
            self.draw_generator()
            self.draw_fractal()

    # --- CALCOLO E DISEGNO DEL FRATTALE ---
    def draw_fractal(self):
        self.fractal_canvas.delete("all")
        w = self.fractal_canvas.winfo_width()
        h = self.fractal_canvas.winfo_height()
        if w < 10 or h < 10:
            return

        base_len = min(w, h) * 0.6
        # Segmento iniziale orizzontale centrato
        segments = [(-base_len / 2, 0, base_len / 2, 0)]

        # Generazione iterativa
        for _ in range(self.iterations):
            next_segs = []
            for x1, y1, x2, y2 in segments:
                dx = x2 - x1
                dy = y2 - y1
                prev_x, prev_y = x1, y1

                for fold in self.folds:
                    u = fold["u"]
                    v = fold["v"]
                    nx = x1 + u * dx - v * dy
                    ny = y1 + u * dy + v * dx
                    next_segs.append((prev_x, prev_y, nx, ny))
                    prev_x, prev_y = nx, ny

                next_segs.append((prev_x, prev_y, x2, y2))
            segments = next_segs

        # Disegna tutti i segmenti con gradiente cromatico
        total = len(segments)
        cx, cy = w / 2, h / 2

        for i, (x1, y1, x2, y2) in enumerate(segments):
            # Gradiente da Ciano a Magenta fluo
            t = i / max(1, total)
            r = int(60 + 190 * t)
            g = int(200 - 150 * t)
            b = 255
            color = f"#{r:02x}{g:02x}{b:02x}"

            self.fractal_canvas.create_line(
                cx + x1, cy + y1, cx + x2, cy + y2,
                fill=color, width=1
            )

        self.update_stats()

    def on_slider_change(self, val):
        self.iterations = int(val)
        self.iter_label.config(text=f"Iterazioni: {self.iterations}")
        self.draw_fractal()

    # --- PRESET ---
    def preset_levy(self):
        self.folds = [{"u": 0.5, "v": 0.5}]
        self.iter_slider.set(8)
        self.draw_generator()
        self.draw_fractal()

    def preset_tent(self):
        self.folds = [{"u": 0.5, "v": 0.866}]
        self.iter_slider.set(6)
        self.draw_generator()
        self.draw_fractal()

    def preset_z(self):
        self.folds = [{"u": 0.33, "v": 0.4}, {"u": 0.66, "v": -0.4}]
        self.iter_slider.set(5)
        self.draw_generator()
        self.draw_fractal()

    def preset_koch(self):
        self.folds = [
            {"u": 1/3, "v": 0},
            {"u": 1/2, "v": math.sqrt(3)/6},
            {"u": 2/3, "v": 0}
        ]
        self.iter_slider.set(4)
        self.draw_generator()
        self.draw_fractal()

if __name__ == "__main__":
    root = tk.Tk()
    app = FractalApp(root)
    root.mainloop()