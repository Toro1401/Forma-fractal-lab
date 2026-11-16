"""Persistence checks use temporary projects, never the user's preset file."""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sys
import tempfile
from threading import Thread
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from serve import HEADER, PREFIX, PresetStore, make_server, validate_project


def project(name='Test'):
    return {'version': 3, 'name': name, 'folds': [{'u': .5, 'v': .5}],
            'origin': {'u': 0, 'v': 0}, 'endpoint': {'u': 1, 'v': 0},
            'directions': [1, -1], 'constraints': {'lengths': [None, None], 'groups': [0, 0], 'turns': [None], 'heading': None},
            'iterations': 5, 'mirror': False, 'palette': 'lime', 'colorMode': 'gradient',
            'colorStart': '#769b5a', 'colorEnd': '#e9ffd0', 'lineWidth': 1.3}


class PersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='.qa-store-', dir=Path(__file__).resolve().parents[1])
        self.root = Path(self.temporary.name)
        (self.root / 'dist').mkdir()
        self.path = self.root / 'dist' / 'user-presets.js'
        self.path.write_text(HEADER + PREFIX + '{"version":1,"presets":[]};\n', encoding='utf-8')
        self.store = PresetStore(self.path)

    def tearDown(self):
        self.assertEqual(self.root.resolve().parent, Path(__file__).resolve().parents[1])
        self.assertTrue(self.root.name.startswith('.qa-store-'))
        self.temporary.cleanup()

    def test_save_reload_update_and_delete(self):
        saved = self.store.save(project('Prova <sicura>'))
        preset_id = saved['saved_id']
        reopened = PresetStore(self.path)
        self.assertEqual(reopened.read()['presets'][0]['project']['name'], 'Prova <sicura>')
        updated = reopened.save(project('Aggiornato'), preset_id)
        self.assertEqual(updated['saved_id'], preset_id)
        self.assertEqual(len(updated['presets']), 1)
        self.assertIn('Aggiornato', self.path.read_text(encoding='utf-8'))
        self.assertEqual(reopened.delete(preset_id)['presets'], [])

    def test_version5_generators_and_settings_round_trip(self):
        baseline = validate_project(project('Versione cinque'))
        for mode in ('polyline', 'branches', 'free', 'ifs', 'lsystem'):
            value = {**baseline, 'version': 5, 'mode': mode,
                     'composition': {'kind': 'polygon', 'count': 5, 'angle': 12, 'reflect': False, 'inward': True},
                     'growth': {'linked': True, 'jitter': .1, 'seed': 2026},
                     'foldSequence': [{'kind': 'rotate', 'angle': -90}, {'kind': 'reflect', 'angle': 30}],
                     'structureColor': 'family'}
            saved = self.store.save(value)
            reopened = PresetStore(self.path).read()['presets'][-1]['project']
            self.assertEqual(reopened['version'], 5)
            self.assertEqual(reopened['mode'], mode)
            self.assertEqual(reopened['growth']['seed'], 2026)
            self.assertEqual(reopened['foldSequence'], value['foldSequence'])
            self.assertEqual(validate_project(reopened), reopened)
        before = self.path.read_bytes()
        invalid_values = [
            {'composition': {'kind': 'polygon', 'count': 2}},
            {'growth': {'seed': True}},
            {'foldSequence': [{'kind': 'unknown', 'angle': 90}]},
            {'ifs': {'transforms': [{'x': 0, 'y': 0, 'scaleX': .98, 'scaleY': .98, 'angle': 0, 'shear': .8}]}},
            {'lsystem': {'axiom': 'F]'}},
        ]
        for changes in invalid_values:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.store.save({**value, **changes})
        self.assertEqual(self.path.read_bytes(), before)

    def test_invalid_data_never_replaces_existing_file(self):
        self.store.save(project())
        before = self.path.read_bytes()
        invalid = project()
        invalid['constraints']['lengths'] = [.2, .2]
        with self.assertRaises(ValueError):
            self.store.save(invalid)
        invalid = project()
        invalid['origin']['u'] = float('inf')
        with self.assertRaises(ValueError):
            self.store.save(invalid)
        with self.assertRaises(LookupError):
            self.store.save(project(), 'missing')
        self.assertEqual(self.path.read_bytes(), before)

    def test_branch_presets_round_trip_and_validation(self):
        value = project('Spirale personale')
        value.update(version=4, mode='branches', branches=[{'angle': 30, 'ratio': .87, 'attach': 1, 'flip': False}, {'angle': -60, 'ratio': .5, 'attach': .8, 'flip': True}],
                     iterations=28, endpoint={'u': 0, 'v': 1}, lineWidth=11, taper=1, minBranch=.003, background='#ffffff')
        self.store.save(project('Vecchio preset'))
        saved = self.store.save(value)
        reopened = PresetStore(self.path).read()['presets']
        self.assertEqual(len(reopened), 2)
        self.assertEqual(reopened[0]['project']['mode'], 'polyline')
        self.assertEqual(reopened[1]['project'], {**value, 'transformKind': 'rotate', 'transformAngle': 45, 'colorMiddle': None, 'radialCopies': 1})
        before = self.path.read_bytes()
        for changes in ({'branches': []}, {'minBranch': 0}, {'taper': -1}, {'mode': 'bad'}, {'background': 'white'}, {'iterations': 33}, {'branches': [{'angle': 30, 'ratio': True, 'attach': 1, 'flip': False}]}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.store.save({**value, **changes}, saved['saved_id'])
        self.assertEqual(self.path.read_bytes(), before)

    def test_atomic_write_failure_preserves_source(self):
        before = self.path.read_bytes()
        with patch('serve.os.replace', side_effect=OSError('write denied')):
            with self.assertRaises(OSError):
                self.store.save(project())
        self.assertEqual(self.path.read_bytes(), before)
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_extended_copy_depth_round_trip(self):
        saved = self.store.save(project('Copie profonde'))
        value = saved['presets'][0]['project']
        value.update(mode='free', iterations=20, transformAngle=90)
        self.store.save(value, saved['saved_id'])
        reopened = PresetStore(self.path).read()['presets'][0]['project']
        self.assertEqual(reopened['iterations'], 20)
        self.assertEqual(reopened['mode'], 'free')
        before = self.path.read_bytes()
        with self.assertRaises(ValueError):
            self.store.save({**value, 'iterations': 21}, saved['saved_id'])
        self.assertEqual(self.path.read_bytes(), before)

    def test_parallel_saves_and_limit(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda i: self.store.save(project(str(i))), range(6)))
        self.assertEqual(len(self.store.read()['presets']), 6)
        for i in range(18):
            self.store.save(project('Extra ' + str(i)))
        with self.assertRaises(ValueError):
            self.store.save(project('Too many'))
        self.assertEqual(len(self.store.read()['presets']), 24)

    def test_damaged_file_is_not_overwritten(self):
        self.path.write_text('not valid source', encoding='utf-8')
        with self.assertRaises(ValueError):
            self.store.save(project())
        self.assertEqual(self.path.read_text(encoding='utf-8'), 'not valid source')

    def test_http_persistence_origin_and_restart(self):
        server = make_server(self.root, 0)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = 'http://127.0.0.1:' + str(server.server_port)
            request = Request(base + '/api/presets', data=json.dumps({'project': project('HTTP')}).encode(), headers={'Content-Type': 'application/json', 'Origin': base}, method='POST')
            with urlopen(request) as response:
                result = json.load(response)
                self.assertIsNone(response.headers.get('WWW-Authenticate'))
            self.assertEqual(len(result['presets']), 1)
            blocked = Request(base + '/api/presets', data=json.dumps({'project': project('Blocked')}).encode(), headers={'Content-Type': 'application/json', 'Origin': 'https://example.com'}, method='POST')
            with self.assertRaises(HTTPError) as error:
                urlopen(blocked)
            self.assertEqual(error.exception.code, 403)
            self.assertEqual(len(self.store.read()['presets']), 1)
            with urlopen(base + '/user-presets.js') as response:
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
                self.assertIn(b'HTTP', response.read())
        finally:
            server.shutdown(); server.server_close(); thread.join()
        # A new server instance reads the file without any browser state.
        server = make_server(self.root, 0)
        thread = Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            with urlopen('http://127.0.0.1:' + str(server.server_port) + '/api/presets') as response:
                self.assertEqual(json.load(response)['presets'][0]['project']['name'], 'HTTP')
        finally:
            server.shutdown(); server.server_close(); thread.join()

    def test_source_reload_never_uses_cached_timestamps(self):
        for name in ('index.html', 'app.js', 'engine.js', 'constraints.js', 'styles.css'):
            (self.root / 'dist' / name).write_text('old source', encoding='utf-8')
        server = make_server(self.root, 0)
        thread = Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            base = 'http://127.0.0.1:' + str(server.server_port)
            for name in ('index.html', 'app.js', 'engine.js', 'constraints.js', 'styles.css', 'user-presets.js'):
                with self.subTest(name=name):
                    url = base + '/' + name + '?v=20261111-2'
                    with urlopen(url) as response:
                        self.assertEqual(response.headers['Cache-Control'], 'no-store')
                    if name != 'user-presets.js':
                        (self.root / 'dist' / name).write_text('new source', encoding='utf-8')
                    request = Request(url, headers={'If-Modified-Since': 'Wed, 01 Jan 2098 00:00:00 GMT'})
                    with urlopen(request) as response:
                        self.assertEqual(response.status, 200)
                        self.assertEqual(response.headers['Cache-Control'], 'no-store')
                        if name != 'user-presets.js':
                            self.assertEqual(response.read(), b'new source')
        finally:
            server.shutdown(); server.server_close(); thread.join()


if __name__ == '__main__':
    unittest.main()
