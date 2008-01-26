/* ================================================================ *
    jsonzip-main.js
    Copyright (c) 2006-2007 Kawasaki Yusuke <u-suke [at] kawa.net>

    Permission is hereby granted, free of charge, to any person
    obtaining a copy of this software and associated documentation
    files (the "Software"), to deal in the Software without
    restriction, including without limitation the rights to use,
    copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following
    conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
    OTHER DEALINGS IN THE SOFTWARE.
* ================================================================ */

JsonpZip = {};
JsonpZip.URL = 'http://192.168.1.150/svn/trunk/jsonpzip/';
JsonpZip.VERSION = '0.01';
JsonpZip.common = function () {};

/* ********************************************************* */

//	JSONP から呼び出される共通メソッド

JsonpZip.common.prototype.callback = function ( arg ) {
    if ( ! arg ) return;
    this.store_cache( arg.index, arg.data );
    this.check_task();
};

//	キャッシュにデータを格納する

JsonpZip.common.prototype.store_cache = function ( idx, data ) {
    if ( ! this._cache ) this._cache = [];
    this._cache[idx] = data;
}

//	キャッシュ状況を確認し、キャッシュにあればそれを返す

JsonpZip.common.prototype.check_cache = function ( idx ) {
    if ( ! this._cache ) this._cache = [];
    return this._cache[idx];
}

//	新しい非同期タスク（キャッシュ付）を開始する

JsonpZip.common.prototype.start_task = function ( chain, key ) {
    var idx = this.index_key( key );
    var data = this.check_cache( idx );
    if ( data ) {
        chain( data );
    } else {
        var __this = this;
        var next = function () {
            data = __this.check_cache( idx );
            if ( ! data ) return false;
            chain( data );
            return true;
        };
        this.queue_task( next );
        var src = this.jsonp_url( idx );
        var suffix = this.url_suffix();
        if ( suffix ) src += suffix;
        this.load_jsonp( src );
    }
}

//	タスクをタスクリストに登録する

JsonpZip.common.prototype.queue_task = function ( chain ) {
    if ( ! this._tasklist ) this._tasklist = [];
    this._tasklist.push( chain );
}

//	各タスクを呼び出し、true が返ればタスク終了、false が返れば後で再確認する

JsonpZip.common.prototype.check_task = function () {
    if ( ! this._tasklist ) return;
    if ( ! this._tasklist[0] ) this._tasklist.shift();
    for( var i=0; i<this._tasklist.length; i++ ) {
        var next = this._tasklist[i];
        if ( ! next ) continue;
        var stat = next();
        if ( stat ) this._tasklist[i] = null;
    }
}

JsonpZip.common.prototype.load_jsonp = function ( src ) {
    var next = function () {
        var script = document.createElement( 'script' );
        script.charset = 'utf-8';
        script.type = 'text/javascript';
        script.src = src;
        document.lastChild.appendChild( script );
    };
//  setTimeout( next, 1 );
	next();
};

JsonpZip.common.prototype.url_suffix = function () {
	var suffix = '';
	suffix += '?v='+JsonpZip.VERSION;
	return suffix;
}
JsonpZip.common.prototype.get_class = function () {
	return 'common';
}
JsonpZip.common.prototype.index_key = function ( idx ) {
	return idx;
};
JsonpZip.common.prototype.list_to_hash = function ( list, kcol, vcol ) {
	var hash = [];
	for( var i=0; i<list.length; i++ ) {
		hash[list[i][kcol]] = list[i][vcol];
	}
	return hash;
}

//	配列の特定カラムを完全一致で検索して、マッチした全てのレコードを配列で返す
//	( grep { $_->[$col] == $test } @list )

JsonpZip.common.prototype.grep_multiple = function ( list, col, test ) {
	var out = [];
	for( var i=0; i<list.length; i++ ) {
		if ( list[i][col] == test ) {
			out.push( list[i] );
		}
	}
	return out;
}
//	配列の特定カラムを完全一致で検索して、最初にマッチしたレコードを返す
//	( grep { $_->[$col] == $test } @list )[0]

JsonpZip.common.prototype.grep_first = function ( list, col, test ) {
	for( var i=0; i<list.length; i++ ) {
		if ( list[i][col] == test ) return list[i];
	}
}

//	配列の特定カラムを前方一致で検索して、最初にマッチしたレコードを返す
//	( grep { $_->[$col] =~ /^$test/ } @list )[0]

JsonpZip.common.prototype.match_first = function ( list, col, test ) {
	for( var i=0; i<list.length; i++ ) {
		if ( test.indexOf(list[i][col]) == 0 ) return list[i];
	}
}

//	配列の各カラムに名前を振る

JsonpZip.common.prototype.map_title = function ( list, title ) {
	var out = [];
	for( var i=0; i<list.length; i++ ) {
		var line = {};
		for( var j=0; j<title.length; j++ ) {
			var val = list[i][j];
			if ( typeof(val) == 'undefined' ) val = "";
			line[title[j]] = val;
		}
		out.push( line );
	}
	return out;
}

//	配列の各レコードの特定カラムのみを抽出した配列を返す

JsonpZip.common.prototype.map_column = function ( list, col ) {
	var out = [];
	for( var i=0; i<list.length; i++ ) {
		out.push( list[i][col] );
	}
	return out;
}

// 	プルダウンの値を取得する

JsonpZip.common.prototype.get_select_value = function ( elem ) {
    var opts = elem.options;
    if ( ! opts ) return;
    for( var i=0; i<opts.length; i++ ) {
        if ( opts[i].selected ) return opts[i].value;
    }
};

JsonpZip.common.prototype.addEventListener = function ( elem, type, chain ) {
    if ( window.Event && Event.observe ) {
        Event.observe( elem, type, chain );
    } else if ( window.jQuery ) {
        jQuery( elem ).bind( type, chain );
    } else {
		var save = elem["on"+type];
		if ( save ) {
			var __chain = chain;
			chain = function ( ev ) {
				__chain( ev );
				save( ev );
			}
		}
        elem["on"+type] = chain;
    }
}

/* ********************************************************* */

JsonpZip.master = new JsonpZip.common();
JsonpZip.addr2zip = new JsonpZip.common();
JsonpZip.zip2addr = new JsonpZip.common();
JsonpZip.util = new JsonpZip.common();

/* ********************************************************* */

JsonpZip.master.get_class = function () { return 'master'; }
JsonpZip.addr2zip.get_class = function () { return 'addr2zip'; }
JsonpZip.zip2addr.get_class = function () { return 'zip2addr'; }

/* ********************************************************* */

JsonpZip.master.jsonp_url = function ( idx ) {
	var url = JsonpZip.URL;
	url += 'master/'+idx+'.jsonp';
	return url;
};
JsonpZip.addr2zip.jsonp_url = function ( idx ) {
	var adr3 = encodeURIComponent(idx.substr( 0, 3 )).toLowerCase();
	var adr2 = encodeURIComponent(idx.substr( 3, 2 )).toLowerCase();
	adr3 = adr3.replace( /%/g, "" );
	adr2 = adr2.replace( /%/g, "" );
	var url = JsonpZip.URL;
	url += 'addr2zip/'+adr3+'/'+adr2+'.jsonp';
	return url;
};
JsonpZip.zip2addr.jsonp_url = function ( idx ) {
	var zip2 = idx.substr( 0, 2 );
	var zip5 = idx.substr( 0, 5 );
	var url = JsonpZip.URL;
	url += 'zip2addr/'+zip2+'/'+zip5+'.jsonp';
	return url;
};

/* ********************************************************* */

JsonpZip.zip2addr.index_key = function ( zip7 ) {
	return zip7.substr( 0, 5 );
};
JsonpZip.addr2zip.index_key = function ( addr ) {
	var addr = addr.replace( /^京都府京都市/, "京都市" );
	return addr.substr( 0, 5 );
};

/* ********************************************************* */

JsonpZip.master.get_prefcd_by_addr = function ( chain, pref ) {
	if ( this._pref2prefcd ) {
		var prefcd = this._pref2prefcd[pref];
		return chain( prefcd );
	}
	var idx = 'preflist';
	var __this = this;
	var next = function ( data ) {
		__this._pref2prefcd = __this.list_to_hash( data, 1, 0 );;
		var prefcd = __this._pref2prefcd[pref];
		return chain( prefcd );
	};
	this.start_task( next, idx );
};
JsonpZip.master.get_pref_by_prefcd = function ( chain, prefcd ) {
	if ( this._prefcd2pref ) {
		var pref = this._prefcd2pref[prefcd];
		return chain( pref );
	}
	var idx = 'preflist';
	var __this = this;
	var next = function ( data ) {
		__this._prefcd2pref = __this.list_to_hash( data, 0, 1 );;
		var pref = __this._prefcd2pref[prefcd];
		return chain( pref );
	};
	this.start_task( next, idx );
};
JsonpZip.master.get_preflist = function ( chain ) {
	if ( this._pref_cache ) {
		var list = this._pref_cache;
		return chain( list );
	}
	var idx = 'preflist';
	var __this = this;
	var next = function ( data ) {
		var list = __this.map_title( data, ['prefcd','pref'] );
		this._pref_cache = list;
		return chain( list );
	};
	this.start_task( next, idx );
};
JsonpZip.master.get_citylist_by_pref = function ( chain, pref ) {
	if ( ! this._city_cache ) this._city_cache = {};
	if ( this._city_cache[pref] ) {
		var list = this._city_cache[pref];
		return chain( list );
	}
	var idx = 'citylist';
	var __this = this;
	var next = function ( data ) {
		var array = __this.grep_first( data, 1, pref );
		if ( ! array ) return;
		__this._city_cache[pref] = __this.map_title( array[2], ['citycd','city'] );
		var list = __this._city_cache[pref];
		return chain( list );
	};
	this.start_task( next, idx );
};
JsonpZip.master.get_arealist_by_city = function ( chain, city ) {
	if ( ! this._area_cache ) this._area_cache = {};
	if ( this._area_cache[city] ) {
		var list = this._area_cache[city];
		return chain( list );
	}
	var __this = this;
	var next = function ( list ) {
		__this._area_cache[city] = list;
		chain( list );
	};
	JsonpZip.addr2zip.get_arealist_by_addr( next, city );
};
JsonpZip.master.get_city_by_citycd = function ( chain, citycd ) {
	var idx = 'citylist';
	var __this = this;
	var next = function ( data ) {
		for( var i=0; i<data.length; i++ ) {
			var array = __this.grep_first( data[i][2], 0, citycd );
			if ( ! array ) return;
//			var prefcd = data[i][0];
			var pref = data[i][1];
			var city = array[1];
			return chain( pref+city );
		}
	};
	this.start_task( next, idx );
};
JsonpZip.master.get_citycd_by_addr = function ( chain, addr ) {
	var idx = 'citylist';
	var __this = this;
	var next = function ( data ) {
		for( var i=0; i<data.length; i++ ) {
			var pref = data[i][1];
			if ( pref != addr.substr( 0, pref.length )) continue;
			var rest = addr.substr( pref.length );
			var array = __this.grep_first( data[i][2], 1, rest );
			if ( array ) return chain( array[0] );
		}
	};
	this.start_task( next, idx );
};

/* ********************************************************* */

JsonpZip.zip2addr.get_addr_by_zipcd = function ( chain, zip7 ) {
	var next = function ( list ) {
		if ( ! list ) return;
		if ( ! list.length ) return;
		var pref = list[0].pref;
		var city = list[0].city;
		var area = list[0].area;
		var strt = list[0].strt;
		for( var i=0; i<list.length; i++ ) {
			if ( pref != list[i].pref ) {
				pref = "";
				break;
			} else if ( city != list[i].city ) {
				city = "";
			} else if ( area != list[i].area ) {
				area = "";
			} else if ( strt != list[i].strt ) {
				strt = "";
			}
		}
		if ( pref == "" ) city = "";
		if ( city == "" ) area = "";
		if ( area == "" ) strt = "";
		var ret = {};
		ret.pref = pref;
		ret.city = city;
		ret.area = area;
		ret.strt = strt ? strt : "";
		return chain( ret );
	}
	this.get_addrlist_by_zipcd( next, zip7 );
};
JsonpZip.zip2addr.get_addrlist_by_zipcd = function ( chain, zip7 ) {
	var __this = this;
	var next = function ( data ) {
		var array = __this.grep_multiple( data, 0, zip7 );
		if ( ! array ) return;
		var map = __this.map_title( array, ['zip7','pref','city','area','strt'] );
		return chain( map );
	};
	this.start_task( next, zip7 );
};

/* ********************************************************* */

JsonpZip.addr2zip.get_ziplist_by_addr = function ( chain, addr ) {
	var __this = this;
	var next = function ( data ) {
		var array = [];
		for( var i=0; i<data.length; i++ ) {
			var prefcity = data[i][0]+data[i][1];
			if ( prefcity != addr.substr( 0, prefcity.length )) continue;
			var rest = addr.substr( prefcity.length );
			var array = __this.match_first( data[i][2], 0, rest );
			if ( ! array ) return;
			var ret = array.slice( 1 );
			return chain( ret );
		}
	};
	this.start_task( next, addr );
};
JsonpZip.addr2zip.get_arealist_by_addr = function ( chain, addr ) {
	var __this = this;
	var next = function ( data ) {
		for( var i=0; i<data.length; i++ ) {
			var prefcity = data[i][0]+data[i][1];
			if ( prefcity != addr.substr( 0, prefcity.length )) continue;
			var list = [];
			for( var j=0; j<data[i][2].length; j++ ) {
				list.push( data[i][2][j][0] );
			}
			return chain( list );
		}
	};
	this.start_task( next, addr );
};

/* ********************************************************* */

JsonpZip.element = function ( elem, column, onchange ) {
	this.elem = elem;
	this.column = column;
	this.onchange = onchange;
	var tag = elem.tagName.toLowerCase();
	if ( tag == 'select' ) {
		this.type_select = true;
		this.default_length = elem.length;
	} else if ( tag == 'input' ) {
		this.type_text = true;
	}
	var __this = this;
	var func1 = function () {
		__this.onchange( __this );
	};
	JsonpZip.util.addEventListener( elem, 'change', func1 );
	var maxlen = elem.getAttribute( 'maxlength' );
	if ( this.type_text && maxlen ) {
		var func2 = function () {
			var val = __this.get_value();
			if ( val.length != maxlen ) return;
			__this.onchange( __this );
		};
		JsonpZip.util.addEventListener( elem, 'keyup', func2 );
	};
	return this;
};
JsonpZip.element.prototype.init_options = function ( listtxt, listval ) {
    var opts = this.elem.options;
    for( var i=opts.length; i>=this.default_length; i-- ) {
        if ( ! opts[i] ) continue;
        opts[i].parentNode.removeChild( opts[i] );
    }
	if ( ! listtxt ) return;
	for( var i=0; i<listtxt.length; i++ ) {
		var o = document.createElement( 'option' );
		this.elem.appendChild( o );
		o.text = listtxt[i];
		if ( listval ) o.value = listval[i];
	}
};
JsonpZip.element.prototype.set_value = function ( val ) {
	if ( this.type_select ) return this.set_select_value( val );
	if ( this.type_text ) {
		this.elem.value = val;
//		this.elem.focus();
	}
};
JsonpZip.element.prototype.get_value = function () {
	if ( this.type_select ) return this.get_select_value();
	if ( this.type_text ) return this.elem.value;
};
JsonpZip.element.prototype.set_select_value = function ( val ) {
    var opts = this.elem.options;
    if ( ! opts ) return;
    for( var i=0; i<opts.length; i++ ) {
        opts[i].selected = false;
    }
	var count = 0;
    for( var i=0; i<opts.length; i++ ) {
        if ( opts[i].value == val ) {
            opts[i].selected = true;
		count ++;
        }
    }
	if ( count ) return;
    for( var i=0; i<opts.length; i++ ) {
        if ( opts[i].text == val ) {
            opts[i].selected = true;
        }
    }
};
JsonpZip.element.prototype.get_select_value = function () {
	var opt = this.get_option_selected();
	if ( opt ) return opt.value;
};
JsonpZip.element.prototype.get_option_selected = function () {
    var opts = this.elem.options;
    if ( ! opts ) return;
    for( var i=0; i<opts.length; i++ ) {
        if ( opts[i].selected ) return opts[i];
    }
};

/* ********************************************************* */

JsonpZip.form = function ( form ) {
	this.form = form;
	this.input = {};
	var cnt = 0;
	var __this = this;
	var onchange = function ( input ) {
		__this.onChange( input );
	};
	for( var i=0; i<form.elements.length; i++ ) {
		var elem = form.elements[i];
		var rel = elem.getAttribute( 'rel' );
		if ( ! rel ) continue;
		var PREFIX = 'jsonpzip[';
		var pos1 = rel.indexOf( PREFIX );
		var pos2 = rel.indexOf( ']' );
		if ( pos1 == 0 && pos2 > 0 ) {
			pos1 += PREFIX.length;
			var column = rel.substr( pos1, pos2-pos1 );
			var input = new JsonpZip.element( elem, column, onchange );
			if ( ! input ) continue;
			this.input[column] = input;
			cnt ++;
			if ( column == 'pref' ) this.init_preflist();
			if ( column == 'city' ) this.init_citylist();
			if ( column == 'area' ) this.init_arealist();
		}
	}
	if ( ! cnt ) return;
	return this;
};

JsonpZip.form.prototype.init_preflist = function ( chain ) {
	if ( ! this.input.pref.type_select ) return;
	if ( this.input.pref.default_length > 1 ) return;
	var __this = this;
	var next = function ( list ) {
		var txtlist = JsonpZip.util.map_column( list, 'pref' );
		__this.input.pref.init_options( txtlist, txtlist );
		if ( chain ) chain();
	};
	JsonpZip.master.get_preflist( next );
}

JsonpZip.form.prototype.init_citylist = function ( chain ) {
	if ( ! this.input.city.type_select ) return;
	if ( this.input.city.default_length > 1 ) return;
	var __this = this;
	var next = function ( list ) {
		var txtlist = JsonpZip.util.map_column( list, 'city' );
		__this.input.city.init_options( txtlist, txtlist );
		if ( chain ) chain();
	};
	var pref = this.input.pref.get_value();
	if ( ! pref ) return next( [] );
	JsonpZip.master.get_citylist_by_pref( next, pref );
}

JsonpZip.form.prototype.init_arealist = function ( chain ) {
	if ( ! this.input.area.type_select ) return;
	if ( this.input.area.default_length > 1 ) return;
	var __this = this;
	var next = function ( list ) {
		__this.input.area.init_options( list, list );
		if ( chain ) chain();
	};
	var addr = this.input.city.get_value();
	if ( ! addr ) return next( [] );
	if ( this.input.pref ) addr = this.input.pref.get_value() + addr;
	JsonpZip.master.get_arealist_by_city( next, addr );
}

// 	フォームに入力されている郵便番号を取得

JsonpZip.form.prototype.read_zipcd = function () {
	var zip7 = "";
	if ( this.input.zip7 ) {
		zip7 = this.input.zip7.get_value();
	} else if ( this.input.zip3 && this.input.zip4 ) {
		zip7 = this.input.zip3.get_value() + this.input.zip4.get_value();
	}
	zip7 = zip7.replace( /０/g, "0" ).replace( /１/g, "1" ).replace( /２/g, "2" );
	zip7 = zip7.replace( /３/g, "3" ).replace( /４/g, "4" ).replace( /５/g, "5" );
	zip7 = zip7.replace( /６/g, "6" ).replace( /７/g, "7" ).replace( /８/g, "8" );
	zip7 = zip7.replace( /９/g, "9" );
	zip7 = zip7.replace( /[^0-9]/g, "" );
	return zip7;
};

// 	指定された郵便番号をフォームに入力

JsonpZip.form.prototype.write_zipcd = function ( zip7 ) {
	var zip3 = zip7.substr( 0, 3 );
	var zip4 = zip7.substr( 3, 4 );
	if ( this.input.zip7 ) {
		var maxlen = this.input.zip7.elem.getAttribute( 'maxlength' );
		if ( maxlen == 8 ) zip7 = zip3 + '-' + zip4;
		this.input.zip7.set_value( zip7 );
	} else if ( this.input.zip3 && this.input.zip4 ) {
		this.input.zip3.set_value( zip3 );
		this.input.zip4.set_value( zip4 );
	}
};

// 	フォームに入力されている住所を取得

JsonpZip.form.prototype.read_addr = function () {
	var addr = "";
	if ( this.input.pref ) {
		addr = this.input.pref.get_value();
	}
	if ( this.input.addr ) {
		addr += this.input.addr.get_value();
	} else {
		if ( this.input.city ) addr += this.input.city.get_value();
		if ( this.input.area ) addr += this.input.area.get_value();
		if ( this.input.strt ) addr += this.input.strt.get_value();
	}
	return addr;
};

// 	指定された住所オブジェクトから住所フォームを入力

JsonpZip.form.prototype.write_addr = function ( data ) {
	if ( this.input.pref ) {
		this.input.pref.set_value( data.pref );
	}
	if ( this.input.addr ) {
		var addr = data.city + data.area + data.strt;
		if ( ! this.input.pref ) addr = data.pref + addr;
		this.input.addr.set_value( addr );
//		this.input.addr.elem.focus();
	} else {
		var __this = this;
		var next3 = function () {
			if ( __this.input.strt ) {
				__this.input.strt.set_value( data.strt );
//				__this.input.strt.elem.focus();
			} else {
//				__this.input.area.elem.focus();
			}
		};
		var next2 = function () {
			if ( __this.input.area ) {
				__this.write_area( data.area, next3 );
			}
		};
		if ( this.input.city ) {
			this.write_city( data.city, next2 );
		}
	}
};

JsonpZip.form.prototype.write_strt = function ( strt, chain ) {
	if ( ! this.input.strt ) return;
	this.input.strt.set_value( strt );
	if( chain ) chain();
};

JsonpZip.form.prototype.write_area = function ( area, chain ) {
	if ( ! this.input.area ) return;
	var __this = this;
	var next = function () {
		__this.input.area.set_value( area );
		if( chain ) chain();
	};
	if ( this.input.area.type_select ) {
		this.init_arealist( next );
	} else {
		next();
	}
};

JsonpZip.form.prototype.write_city = function ( city, chain ) {
	if ( ! this.input.city ) return;
	var __this = this;
	var next = function () {
		__this.input.city.set_value( city );
		if( chain ) chain();
	};
	if ( this.input.city.type_select ) {
		this.init_citylist( next );
	} else {
		next();
	}
};

JsonpZip.form.prototype.onChange = function ( input, chain ) {
	var __this = this;

	if ( input.column == 'pref' && this.input.city ) {
		if ( this.input.city.type_select ) {
			var next5 = function () {
				__this.onChange( __this.input.city, chain );
			};
			return this.init_citylist( next5 );
		}
	}

	if ( input.column == 'city' && this.input.area ) {
		if ( this.input.area.type_select ) {
			var next4 = function ( list ) {
				__this.onChange( __this.input.area, chain );
			};
			return this.init_arealist( next4 );
		}
	}

	var zip7 = this.read_zipcd();
	if ( ! zip7 ) zip7 = "";
	var addr = this.read_addr();
	if ( ! addr ) addr = "";

	if ( input.column.substr(0,3) == 'zip' ) {
		// 更新のあったカラム種別が zip3,zip4,zip7 の場合
		// 郵便番号　⇒　住所自動入力
		// 郵便番号が7桁でない場合は無視する
		if ( zip7.length != 7 ) return;
		// 最終回と同じ（変更がない）場合は無視する
		if ( zip7 == this.last_zipenter ) return;
		this.last_zipenter = zip7;
		// 住所が一部でも手入力されていれば無視する
		var text = "";
		if ( this.input.pref && this.input.pref.type_text ) text += this.input.pref.get_value();
		if ( this.input.city && this.input.city.type_text ) text += this.input.city.get_value();
		if ( this.input.area && this.input.area.type_text ) text += this.input.area.get_value();
		if ( this.input.strt && this.input.strt.type_text ) text += this.input.strt.get_value();
		if ( this.input.addr && this.input.addr.type_text ) text += this.input.addr.get_value();
		if ( text.length > 0 ) return;
		// 住所を取得する
		var next1 = function ( data ) {
			var newaddr = data.pref + data.city + data.area + data.strt;
			__this.write_addr( data );
			if ( chain ) chain();
		};
		JsonpZip.zip2addr.get_addr_by_zipcd( next1, zip7 );
	} else {
		// 住所　⇒　郵便番号自動入力モード
		// 既に郵便番号が入力済かつ、手動で更新されている場合は無視する
		if ( zip7.length == 7 && zip7 != this.last_zipauto ) return;
		// 住所が3文字以下（未入力 or 都道府県名のみ）の場合は無視する
		if ( ! addr ) return;
		if ( addr.length < 4 ) return;
		// 最終回と同じ（変更がない）場合は無視する
		if ( addr == this.last_addr ) return;
		this.last_addr = addr;
		// 郵便番号を取得する
		var next2 = function ( list ) {
			if ( list.length != 1 ) return;
			var newzip7 = list[0];
			__this.last_zipauto = newzip7;
			__this.write_zipcd( newzip7 );
			if ( chain ) chain();
		};
		JsonpZip.addr2zip.get_ziplist_by_addr( next2, addr );
	}
};

/* ********************************************************* */

JsonpZip.page = function () {
	this.form = [];
	var list = document.getElementsByTagName( 'form' );
	for( var i=0; i<list.length; i++ ) {
		// ページ内のフォームをそれぞれ確認する（複数フォーム対応）
		var temp = new JsonpZip.form( list[i] );
		if ( ! temp ) return;
		this.form.push( temp );
		// 名前付きフォーム <form name="XXXX"> は、JsonpZip.direct.XXXX でアクセス可能
		if ( list[i].name ) {
			if ( ! JsonpZip.direct ) JsonpZip.direct = {};
			JsonpZip.direct[list[i].name] = temp;
		}
	}
	if ( ! this.form.length ) return;
	return this;
};

/* ********************************************************* */

new function () {
	var init = function () {
		new JsonpZip.page();
	};
	setTimeout( init, 1 );
}

/* ********************************************************* */
/*
	JsonpZip.master.get_prefcd_by_addr( function(pref) { alert( pref ); }, '東京都' );
	JsonpZip.master.get_pref_by_prefcd( function(pref) { alert( pref ); }, 13 );
	JsonpZip.master.get_citycd_by_addr(  function(citycd) { alert( citycd ); }, "北海道空知郡上富良野町" );
	JsonpZip.master.get_city_by_citycd( function(addr) { alert( addr ); }, "01460" );
	JsonpZip.addr2zip.get_ziplist_by_addr( function(ret) { alert( ret ); }, "新潟県上越市大潟区潟守新田" );
	JsonpZip.zip2addr.get_addrlist_by_zipcd( function(ret) { alert(ret[0].area+", "+ret[1].area); }, "0110951" );
	JsonpZip.master.get_preflist( init_pullpref );
*/
