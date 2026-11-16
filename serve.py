"""Serve Forma locally and persist editable presets in dist/user-presets.js. No dependencies."""
from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
import re
import tempfile
from threading import RLock
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from uuid import uuid4

HEADER = '// Preset personali di Forma. Questo file fa parte del progetto.\n'
PREFIX = 'globalThis.FORMA_USER_PRESETS = '
MAX_PRESETS = 24


def strict_json(text):
    def reject(value):
        raise ValueError('Valore numerico JSON non valido: ' + value)
    return json.loads(text, parse_constant=reject)


def number(value, low, high):
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high


def validate_project(data):
    if isinstance(data, dict) and type(data.get('version')) is int and data['version'] == 5:
        return validate_project_v5(data)
    if not isinstance(data, dict) or type(data.get('version')) is not int or data['version'] not in (3, 4):
        raise ValueError('Il preset deve contenere un progetto Forma versione 3 o 4.')
    modern = data['version'] == 4
    mode = data.get('mode') if modern else 'polyline'
    if mode not in ('polyline', 'branches', 'free'):
        raise ValueError('Modalità del generatore non valida.')
    branches = data.get('branches') if modern else [{'angle': 30, 'ratio': .7, 'attach': 1, 'flip': False}, {'angle': -30, 'ratio': .7, 'attach': 1, 'flip': False}]
    if not isinstance(branches, list) or not 1 <= len(branches) <= 8 or any(
        not isinstance(r, dict) or not number(r.get('angle'), -180, 180) or not number(r.get('ratio'), .05, 1.25)
        or not number(r.get('attach'), 0, 1) or type(r.get('flip')) is not bool for r in branches):
        raise ValueError('Regole dei rami non valide.')
    min_branch, taper, background = (data.get('minBranch'), data.get('taper'), data.get('background')) if modern else (.003, 0, '#111515')
    if not number(min_branch, .0001, .25) or not number(taper, 0, 1.5) or not isinstance(background, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', background):
        raise ValueError('Dettaglio o stile dei rami non valido.')
    radial_copies=data.get('radialCopies', 1)
    if type(radial_copies) is not int or not 1 <= radial_copies <= 12:
        raise ValueError('Simmetria radiale non valida.')
    transform_kind, transform_angle, color_middle = data.get('transformKind', 'rotate'), data.get('transformAngle', 45), data.get('colorMiddle')
    if transform_kind not in ('rotate', 'reflect') or not number(transform_angle, -360, 360) or (color_middle is not None and (not isinstance(color_middle, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', color_middle))):
        raise ValueError('Trasformazione o colore intermedio non valido.')
    name = data.get('name')
    if not isinstance(name, str) or not name.strip() or len(name) > 60:
        raise ValueError('Il nome deve contenere da 1 a 60 caratteri.')
    def point(value):
        if not isinstance(value, dict) or not all(number(value.get(k), -1000, 1000) for k in ('u', 'v')):
            raise ValueError('Coordinate non valide.')
        return {k: value[k] for k in ('u', 'v')}
    folds = data.get('folds')
    if not isinstance(folds, list) or not 1 <= len(folds) <= 8:
        raise ValueError('Il preset deve avere da 1 a 8 punti intermedi.')
    folds = [point(p) for p in folds]
    origin, endpoint = point(data.get('origin')), point(data.get('endpoint'))
    if math.hypot(endpoint['u'] - origin['u'], endpoint['v'] - origin['v']) < .0001:
        raise ValueError('A e B devono restare distinti.')
    if origin != {'u': 0, 'v': 0}:
        for value in [*folds, endpoint]:
            value['u'] -= origin['u']; value['v'] -= origin['v']
            if abs(value['u']) > 1000 or abs(value['v']) > 1000:
                raise ValueError('La traslazione di A supera il limite delle coordinate.')
        origin = {'u': 0, 'v': 0}
    size = len(folds) + 1
    directions = data.get('directions')
    if not isinstance(directions, list) or len(directions) != size or any(type(v) is not int or v not in (-1, 1) for v in directions):
        raise ValueError('Versi dei lati non validi.')
    c = data.get('constraints')
    if not isinstance(c, dict):
        raise ValueError('Vincoli geometrici mancanti.')
    for key, count in (('lengths', size), ('groups', size), ('turns', size - 1)):
        if not isinstance(c.get(key), list) or len(c[key]) != count:
            raise ValueError('Dimensioni dei vincoli non valide.')
    if any(v is not None and (not number(v, 0, 1000) or v == 0) for v in c['lengths']):
        raise ValueError('Lunghezze non valide.')
    if any(type(v) is not int or not 0 <= v <= 3 for v in c['groups']):
        raise ValueError('Gruppi non validi.')
    if any(v is not None and not number(v, -180, 180) for v in c['turns']):
        raise ValueError('Angoli non validi.')
    if 'heading' not in c or (c['heading'] is not None and not number(c['heading'], -360, 360)):
        raise ValueError('Orientamento non valido.')
    if type(data.get('iterations')) is not int or not 0 <= data['iterations'] <= (32 if mode == 'branches' else 20 if mode == 'free' else 10):
        raise ValueError('Iterazioni non valide.')
    if type(data.get('mirror')) is not bool or not number(data.get('lineWidth'), .5, 12 if modern else 3):
        raise ValueError('Stile non valido.')
    if data.get('palette') not in ('lime', 'aurora', 'ocean', 'ember', 'chalk') or data.get('colorMode') not in ('solid', 'gradient'):
        raise ValueError('Palette o modalità cromatica non valida.')
    if any(not isinstance(data.get(k), str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', data[k]) for k in ('colorStart', 'colorEnd')):
        raise ValueError('Colori non validi.')
    points = [origin, *folds, endpoint]
    vectors = [(b['u'] - a['u'], b['v'] - a['v']) for a, b in zip(points, points[1:])]
    lengths = [math.hypot(*v) for v in vectors]
    def close(a, b):
        return abs(a - b) <= 1e-5 * max(1, abs(b))
    def same_angle(a, b):
        return abs(math.degrees(math.atan2(math.sin(math.radians(a-b)), math.cos(math.radians(a-b))))) <= 1e-5
    if mode != 'branches' and any(target is not None and not close(lengths[i], target) for i, target in enumerate(c['lengths'])):
        raise ValueError('La geometria non rispetta le lunghezze dichiarate.')
    for i, target in enumerate(c['turns']):
        if mode == 'branches' or target is None:
            continue
        a, b = vectors[i:i+2]
        angle = math.degrees(math.atan2(a[0]*b[1]-a[1]*b[0], a[0]*b[0]+a[1]*b[1]))
        if min(lengths[i:i+2]) < 1e-7 or not same_angle(angle, target):
            raise ValueError('La geometria non rispetta gli angoli dichiarati.')
    if mode != 'branches' and c['heading'] is not None and not same_angle(math.degrees(math.atan2(vectors[0][1], vectors[0][0])), c['heading']):
        raise ValueError('La geometria non rispetta l’orientamento dichiarato.')
    for group in (1, 2, 3):
        members = [i for i, g in enumerate(c['groups']) if g == group]
        if mode != 'branches' and members and any(not close(lengths[i], lengths[members[0]]) for i in members):
            raise ValueError('La geometria non rispetta i gruppi di congruenza.')
    result = {key: data[key] for key in ('iterations', 'mirror', 'palette', 'colorMode', 'colorStart', 'colorEnd', 'lineWidth')}
    result.update(version=4, mode=mode, branches=[{key: r[key] for key in ('angle', 'ratio', 'attach', 'flip')} for r in branches], minBranch=min_branch, taper=taper, background=background.lower(),name=name.strip(), folds=folds, origin=origin, endpoint=endpoint, directions=directions,
                  constraints={key: c[key] for key in ('lengths', 'groups', 'turns', 'heading')})
    result.update(radialCopies=radial_copies, transformKind=transform_kind, transformAngle=transform_angle, colorMiddle=color_middle)
    return result


def validate_project_v5(data):
    """Validate the same version-5 contract as the browser, without executing imported data."""
    mode = data.get('mode')
    if mode not in ('polyline', 'branches', 'free', 'ifs', 'lsystem'):
        raise ValueError('Modalità del generatore non valida.')
    maximum = 32 if mode == 'branches' else 20 if mode == 'free' else 10
    if type(data.get('iterations')) is not int or not 0 <= data['iterations'] <= maximum:
        raise ValueError('Iterazioni non valide.')
    result = validate_project({**data, 'version': 4, 'mode': 'polyline' if mode in ('ifs', 'lsystem') else mode})
    def merged(key, defaults):
        value = data.get(key, {})
        if not isinstance(value, dict):
            raise ValueError('Impostazioni non valide: ' + key)
        return {**defaults, **value}
    def require_number(value, low, high, label):
        if not number(value, low, high):
            raise ValueError(label + ' non valido.')
        return value
    def require_bool(value, label):
        if type(value) is not bool:
            raise ValueError(label + ' non valido.')
        return value
    def require_int(value, low, high, label):
        if type(value) is not int or not low <= value <= high:
            raise ValueError(label + ' non valido.')
        return value
    composition = merged('composition', {'kind': 'segment', 'count': 6, 'angle': 0, 'reflect': False, 'inward': False})
    if composition['kind'] not in ('segment', 'radial', 'polygon'):
        raise ValueError('Composizione non valida.')
    composition = {'kind': composition['kind'], 'count': require_int(composition['count'], 3 if composition['kind'] == 'polygon' else 1, 12, 'Numero di settori'),
                   'angle': require_number(composition['angle'], -360, 360, 'Orientamento'),
                   'reflect': require_bool(composition['reflect'], 'Specchio'), 'inward': require_bool(composition['inward'], 'Verso')}
    growth = merged('growth', {'linked': False, 'spread': 1, 'dominance': 1, 'levelAngle': 0, 'levelScale': 1, 'jitter': 0, 'seed': 1, 'alternate': False})
    growth = {**{key: require_bool(growth[key], key) for key in ('linked', 'alternate')},
              **{key: require_number(growth[key], low, high, key) for key, low, high in [('spread', .2, 2), ('dominance', .5, 1.5), ('levelAngle', -20, 20), ('levelScale', .8, 1.05), ('jitter', 0, .3)]},
              'seed': require_int(growth['seed'], 0, 4294967295, 'Seme')}
    sequence = data.get('foldSequence', [])
    if not isinstance(sequence, list) or len(sequence) > 12:
        raise ValueError('Sequenza troppo lunga.')
    validated_sequence = []
    for operation in sequence:
        if not isinstance(operation, dict) or operation.get('kind') not in ('rotate', 'reflect'):
            raise ValueError('Operazione della sequenza non valida.')
        validated_sequence.append({'kind': operation['kind'], 'angle': require_number(operation.get('angle'), -360, 360, 'Angolo')})
    transforms = [{'x': 0, 'y': 0, 'scaleX': .5, 'scaleY': .5, 'angle': 0, 'shear': 0, 'reflect': False},
                  {'x': .5, 'y': 0, 'scaleX': .5, 'scaleY': .5, 'angle': 0, 'shear': 0, 'reflect': False},
                  {'x': .25, 'y': math.sqrt(3)/4, 'scaleX': .5, 'scaleY': .5, 'angle': 0, 'shear': 0, 'reflect': False}]
    ifs = merged('ifs', {'closed': True, 'fill': False, 'transforms': transforms})
    if not isinstance(ifs['transforms'], list) or not 1 <= len(ifs['transforms']) <= 8:
        raise ValueError('Definisci da 1 a 8 copie IFS.')
    transforms = []
    for transform in ifs['transforms']:
        if not isinstance(transform, dict):
            raise ValueError('Copia IFS non valida.')
        t = {key: require_number(transform.get(key, 0) if key == 'shear' else transform.get(key), low, high, key)
             for key, low, high in [('x', -4, 4), ('y', -4, 4), ('scaleX', 0, .98), ('scaleY', 0, .98), ('angle', -360, 360), ('shear', -.8, .8)]}
        t['reflect'] = require_bool(transform.get('reflect', False), 'Specchio')
        trace, det = t['scaleX']**2 + t['scaleY']**2 + t['shear']**2, t['scaleX']*t['scaleY']
        if math.sqrt((trace + math.sqrt(max(0, trace*trace - 4*det*det)))/2) >= .9999:
            raise ValueError('Ogni copia IFS deve essere contrattiva.')
        transforms.append(t)
    ifs = {'closed': require_bool(ifs['closed'], 'Forma chiusa'), 'fill': require_bool(ifs['fill'], 'Riempimento'), 'transforms': transforms}
    lsystem = merged('lsystem', {'axiom': 'F', 'rules': {'F': 'F[+F]F[-F]F'}, 'angle': 25, 'stepScale': .7, 'heading': 90})
    def grammar(text, maximum=512):
        if not isinstance(text, str) or not 1 <= len(text) <= maximum or not re.fullmatch(r'[A-Za-z+\-\[\]]+', text):
            raise ValueError('Grammatica non valida.')
        depth = 0
        for token in text:
            if token == '[':
                depth += 1
            elif token == ']':
                depth -= 1
            if depth < 0:
                raise ValueError('Parentesi non bilanciate.')
        if depth:
            raise ValueError('Parentesi non bilanciate.')
        return text
    rules = lsystem['rules']
    if not isinstance(rules, dict) or not 1 <= len(rules) <= 6 or any(not isinstance(k, str) or not re.fullmatch(r'[A-Za-z]', k) for k in rules):
        raise ValueError('Regole L-system non valide.')
    lsystem = {'axiom': grammar(lsystem['axiom'], 128), 'rules': {k: grammar(v) for k, v in rules.items()},
               'angle': require_number(lsystem['angle'], -180, 180, 'Angolo L-system'), 'stepScale': require_number(lsystem['stepScale'], .1, 1, 'Scala L-system'),
               'heading': require_number(lsystem['heading'], -360, 360, 'Direzione')}
    color = data.get('structureColor', 'spatial')
    if color not in ('spatial', 'generation', 'family'):
        raise ValueError('Colorazione della struttura non valida.')
    result.update(version=5, mode=mode, composition=composition, growth=growth, foldSequence=validated_sequence, ifs=ifs, lsystem=lsystem, structureColor=color)
    return result


class PresetStore:
    def __init__(self, path):
        self.path = Path(path)
        self.lock = RLock()

    def read(self):
        with self.lock:
            source = self.path.read_text(encoding='utf-8')
            if not source.startswith(HEADER + PREFIX) or not source.rstrip().endswith(';'):
                raise ValueError('Il file dei preset non ha un formato riconosciuto. Il contenuto è stato conservato.')
            data = strict_json(source[len(HEADER + PREFIX):].rstrip()[:-1])
            if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('presets'), list) or len(data['presets']) > MAX_PRESETS:
                raise ValueError('Archivio dei preset non valido.')
            records, seen = [], set()
            for item in data['presets']:
                if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not re.fullmatch(r'custom-[a-f0-9]{32}', item['id']) or item['id'] in seen:
                    raise ValueError('Identificatori dei preset non validi.')
                seen.add(item['id'])
                records.append({'id': item['id'], 'project': validate_project(item.get('project'))})
            return {'version': 1, 'presets': records}

    def write(self, data):
        source = HEADER + PREFIX + json.dumps(data, ensure_ascii=True, indent=2, allow_nan=False) + ';\n'
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=self.path.parent, prefix='.user-presets-', suffix='.tmp', delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(source)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, self.path)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    def save(self, project, preset_id=None):
        project = validate_project(project)
        with self.lock:
            data = self.read()
            if preset_id is not None:
                match = next((r for r in data['presets'] if r['id'] == preset_id), None)
                if match is None:
                    raise LookupError('Il preset da aggiornare non esiste più. Salvalo come nuovo.')
                match['project'] = project
            else:
                if len(data['presets']) >= MAX_PRESETS:
                    raise ValueError('Puoi conservare al massimo 24 preset personali nel progetto.')
                preset_id = 'custom-' + uuid4().hex
                data['presets'].append({'id': preset_id, 'project': project})
            self.write(data)
            return {**data, 'saved_id': preset_id}

    def delete(self, preset_id):
        with self.lock:
            data = self.read()
            if not any(r['id'] == preset_id for r in data['presets']):
                raise LookupError('Preset non trovato.')
            data['presets'] = [r for r in data['presets'] if r['id'] != preset_id]
            self.write(data)
            return data


def make_server(project_root, port=8080):
    root = Path(project_root).resolve()
    store = PresetStore(root / 'dist' / 'user-presets.js')

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root / 'dist'), **kwargs)

        def end_headers(self):
            # All local source files can change between reloads, not only presets.
            self.send_header('Cache-Control', 'no-store')
            super().end_headers()

        def send_head(self):
            # Ignore cached timestamps: edits within the same second must be visible.
            for header in ('If-Modified-Since', 'If-None-Match'):
                if header in self.headers:
                    del self.headers[header]
            return super().send_head()

        def json_response(self, status, data):
            body = json.dumps(data, ensure_ascii=True, allow_nan=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def allowed_write(self):
            valid_hosts = {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}
            if self.headers.get('Host') not in valid_hosts or self.headers.get('Sec-Fetch-Site') == 'cross-site':
                return False
            origin = self.headers.get('Origin')
            return origin is None or origin in {f'http://{host}' for host in valid_hosts}

        def do_GET(self):
            path = urlsplit(self.path).path
            if path == '/api/presets':
                try:
                    self.json_response(200, store.read())
                except (ValueError, OSError) as error:
                    self.json_response(500, {'error': str(error)})
            elif path == '/user-presets.js':
                try:
                    body = store.path.read_bytes()
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/javascript; charset=utf-8')
                    self.send_header('Content-Length', str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                except OSError:
                    self.send_error(500, 'Preset file unavailable')
            else:
                super().do_GET()

        def do_POST(self):
            if urlsplit(self.path).path != '/api/presets':
                return self.json_response(404, {'error': 'Percorso non trovato.'})
            if not self.allowed_write():
                return self.json_response(403, {'error': 'Richiesta consentita soltanto dall’app locale.'})
            try:
                size = int(self.headers.get('Content-Length', 0))
                if not 0 < size <= 65536 or self.headers.get_content_type() != 'application/json':
                    raise ValueError('Formato o dimensioni della richiesta non validi.')
                payload = strict_json(self.rfile.read(size).decode('utf-8'))
                if not isinstance(payload, dict):
                    raise ValueError('Richiesta non valida.')
                self.json_response(200, store.save(payload.get('project'), payload.get('id')))
            except LookupError as error:
                self.json_response(404, {'error': str(error)})
            except (ValueError, UnicodeError) as error:
                self.json_response(400, {'error': str(error)})
            except OSError:
                self.json_response(500, {'error': 'Scrittura non riuscita. Controlla i permessi del file dei preset.'})

        def do_DELETE(self):
            path = urlsplit(self.path).path
            if not path.startswith('/api/presets/'):
                return self.json_response(404, {'error': 'Percorso non trovato.'})
            if not self.allowed_write():
                return self.json_response(403, {'error': 'Richiesta consentita soltanto dall’app locale.'})
            try:
                self.json_response(200, store.delete(path.rsplit('/', 1)[-1]))
            except LookupError as error:
                self.json_response(404, {'error': str(error)})
            except (ValueError, OSError) as error:
                self.json_response(500, {'error': str(error)})

    return ThreadingHTTPServer(('127.0.0.1', port), Handler)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Forma: app e preset salvati nel progetto, solo in locale.')
    parser.add_argument('--port', type=int, default=8080)
    args = parser.parse_args()
    try:
        server = make_server(Path(__file__).parent, args.port)
        print(f'Forma: http://127.0.0.1:{server.server_port}\nPreset personali: dist/user-presets.js\nCtrl+C per arrestare.', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
    except OSError as error:
        parser.exit(1, f'Avvio non riuscito: {error}\n')
