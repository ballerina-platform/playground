// Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

//go:build wasm

package main

import (
	"ballerina-lang-go/common/bfs"
	"bytes"
	"io"
	"io/fs"
	"path"
	"syscall/js"
	"time"
)

var (
	_ bfs.WritableFS = &localStorageFS{}
	_ bfs.MutableFS  = &localStorageFS{}
)

type localStorageFS struct {
	proxy js.Value
}

func NewLocalStorageFS(proxy js.Value) *localStorageFS {
	return &localStorageFS{
		proxy: proxy,
	}
}

func (l *localStorageFS) Create(name string) (fs.File, error) {
	l.proxy.Call("writeFile", name, "")
	return l.Open(name)
}

func (l *localStorageFS) MkdirAll(path string, perm fs.FileMode) error {
	res := l.proxy.Call("mkdirAll", path)
	if res.IsNull() || res.IsUndefined() || (res.Type() == js.TypeBoolean && !res.Bool()) {
		return &fs.PathError{Op: "mkdirAll", Path: path, Err: fs.ErrNotExist}
	}
	return nil
}

func (l *localStorageFS) Move(oldpath string, newpath string) error {
	res := l.proxy.Call("move", oldpath, newpath)
	if res.IsNull() || res.IsUndefined() || (res.Type() == js.TypeBoolean && !res.Bool()) {
		return &fs.PathError{Op: "move", Path: oldpath, Err: fs.ErrNotExist}
	}
	return nil
}

func (l *localStorageFS) OpenFile(name string, _ int, _ fs.FileMode) (fs.File, error) {
	return l.Open(name)
}

func (l *localStorageFS) Remove(name string) error {
	res := l.proxy.Call("remove", name)
	if res.IsNull() || res.IsUndefined() || (res.Type() == js.TypeBoolean && !res.Bool()) {
		return &fs.PathError{Op: "remove", Path: name, Err: fs.ErrNotExist}
	}
	return nil
}

func (l *localStorageFS) Open(name string) (fs.File, error) {
	result := l.proxy.Call("open", name)
	if result.IsNull() || result.IsUndefined() {
		stat := l.proxy.Call("stat", name)
		if !stat.IsNull() && !stat.IsUndefined() && stat.Get("isDir").Bool() {
			return l.openDir(name, stat)
		}
		return nil, &fs.PathError{Op: "open", Path: name, Err: fs.ErrNotExist}
	}

	if result.Get("isDir").Bool() {
		return l.openDir(name, result)
	}

	return &localStorageFileHandle{
		info: &localStorageFileInfo{
			name:    path.Base(name),
			size:    int64(result.Get("size").Int()),
			isDir:   false,
			modTime: time.Unix(int64(result.Get("modTime").Int()), 0),
		},
		reader: bytes.NewReader([]byte(result.Get("content").String())),
	}, nil
}

func (l *localStorageFS) openDir(name string, stat js.Value) (fs.File, error) {
	localStorageEntries := l.proxy.Call("readDir", name)
	if localStorageEntries.IsNull() || localStorageEntries.IsUndefined() {
		return nil, &fs.PathError{Op: "readDir", Path: name, Err: fs.ErrNotExist}
	}
	entries := make([]fs.DirEntry, localStorageEntries.Length())
	for i := 0; i < localStorageEntries.Length(); i++ {
		e := localStorageEntries.Index(i)
		entries[i] = &localStorageDirEntry{
			name:  e.Get("name").String(),
			isDir: e.Get("isDir").Bool(),
		}
	}

	return &localStorageDirHandle{
		info: &localStorageFileInfo{
			name:    path.Base(name),
			isDir:   true,
			modTime: time.Unix(int64(stat.Get("modTime").Int()), 0),
		},
		entries: entries,
	}, nil
}

func (l *localStorageFS) WriteFile(name string, data []byte, perm fs.FileMode) error {
	res := l.proxy.Call("writeFile", name, string(data))
	if res.IsNull() || res.IsUndefined() || (res.Type() == js.TypeBoolean && !res.Bool()) {
		return &fs.PathError{Op: "writeFile", Path: name, Err: fs.ErrNotExist}
	}
	return nil
}

type (
	localStorageFileHandle struct {
		info   *localStorageFileInfo
		reader *bytes.Reader
	}
	localStorageDirHandle struct {
		info    *localStorageFileInfo
		entries []fs.DirEntry
		offset  int
	}
	localStorageFileInfo struct {
		name    string
		size    int64
		isDir   bool
		modTime time.Time
	}
	localStorageDirEntry struct {
		name  string
		isDir bool
	}
)

func (h *localStorageFileHandle) Close() error               { return nil }
func (h *localStorageFileHandle) Read(p []byte) (int, error) { return h.reader.Read(p) }
func (h *localStorageFileHandle) Stat() (fs.FileInfo, error) { return h.info, nil }

func (h *localStorageDirHandle) Close() error               { return nil }
func (h *localStorageDirHandle) Read([]byte) (int, error)   { return 0, io.EOF }
func (h *localStorageDirHandle) Stat() (fs.FileInfo, error) { return h.info, nil }
func (h *localStorageDirHandle) ReadDir(n int) ([]fs.DirEntry, error) {
	if n <= 0 {
		res := h.entries[h.offset:]
		h.offset = len(h.entries)
		return res, nil
	}
	if h.offset >= len(h.entries) {
		return nil, io.EOF
	}
	end := h.offset + n
	if end > len(h.entries) {
		end = len(h.entries)
	}
	res := h.entries[h.offset:end]
	h.offset = end
	return res, nil
}

func (i *localStorageFileInfo) Name() string { return i.name }
func (i *localStorageFileInfo) Size() int64  { return i.size }
func (i *localStorageFileInfo) Mode() fs.FileMode {
	if i.isDir {
		return fs.ModeDir | 0o755
	}
	return 0o644
}
func (i *localStorageFileInfo) ModTime() time.Time { return i.modTime }
func (i *localStorageFileInfo) IsDir() bool        { return i.isDir }
func (i *localStorageFileInfo) Sys() any           { return nil }

func (d *localStorageDirEntry) Name() string { return d.name }
func (d *localStorageDirEntry) IsDir() bool  { return d.isDir }
func (d *localStorageDirEntry) Type() fs.FileMode {
	if d.isDir {
		return fs.ModeDir
	}
	return 0
}

func (d *localStorageDirEntry) Info() (fs.FileInfo, error) {
	return &localStorageFileInfo{name: d.name, isDir: d.isDir}, nil
}
