/* ================================================================ *
    JsonZip
    Copyright (c) 2006-2008 Kawasaki Yusuke <u-suke [at] kawa.net>

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

if ( typeof(JsonpZip) == 'undefined' ) JsonpZip = {};
if ( typeof(JsonpZip.JSONP_BASE) == 'undefined' ) {
	JsonpZip.JSONP_BASE = 'http://jsonp-hosting.googlecode.com/svn/trunk/jsonpzip/jsonp/';
}
JsonpZip.VERSION = '0.01';
JsonpZip.Base = function () { return this; };

/* ********************************************************* */

JsonpZip.Base.prototype.list_to_hash = function ( list, kcol, vcol ) {
	var hash = [];
	for( var i=0; i<list.length; i++ ) {
		hash[list[i][kcol]] = list[i][vcol];
	}
	return hash;
}

//	配列の特定カラムを完全一致で検索して、マッチした全てのレコードを配列で返す
//	( grep { $_->[$col] == $test } @list )

JsonpZip.Base.prototype.grep_multiple = function ( list, col, test ) {
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

JsonpZip.Base.prototype.grep_first = function ( list, col, test ) {
	for( var i=0; i<list.length; i++ ) {
		if ( list[i][col] == test ) return list[i];
	}
}

//	配列の特定カラムを前方一致で検索して、最初にマッチしたレコードを返す
//	配列にある文字列の方が短い。チェック用文字列の方が長い。
//	( grep { $_->[$col] =~ /^$test/ } @list )[0]

JsonpZip.Base.prototype.match_first = function ( list, col, test ) {
	var ret;
	var max = -1;
	for( var i=0; i<list.length; i++ ) {
		if ( test.indexOf(list[i][col]) == 0 ) {
			var len = list[i][col].length;
			if ( len > max ) {
				ret = list[i];
				max = len;
			}
		}
	}
	return ret;
}

//	配列の各カラムに名前を振る

JsonpZip.Base.prototype.map_title = function ( list, title ) {
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

JsonpZip.Base.prototype.map_column = function ( list, col ) {
	var out = [];
	for( var i=0; i<list.length; i++ ) {
		out.push( list[i][col] );
	}
	return out;
}

// 	プルダウンの値を取得する

JsonpZip.Base.prototype.addEventListener = function ( elem, type, chain ) {
    if ( window.jQuery ) {
        jQuery( elem ).bind( type, chain );
    } else if ( window.Event && Event.observe ) {
        Event.observe( elem, type, chain );
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

JsonpZip.JsonpCache = function () { return this; };

//	JSONP から呼び出される共通コールバック関数

JsonpZip.JsonpCache.prototype.callback = function ( arg ) {
    if ( ! arg ) return;
    this.store_cache( arg.index, arg.data );
    this.check_task();
};

//	キャッシュにデータを格納する

JsonpZip.JsonpCache.prototype.store_cache = function ( idx, data ) {
    if ( ! this._cache ) this._cache = [];
    this._cache[idx] = data;
}

//	キャッシュ状況を確認し、キャッシュにあればそれを返す

JsonpZip.JsonpCache.prototype.check_cache = function ( idx ) {
    if ( ! this._cache ) this._cache = [];
    return this._cache[idx];
}

//	新しい非同期タスク（キャッシュ付）を開始する

JsonpZip.JsonpCache.prototype.load_run = function ( chain, key ) {
    var idx = this.index_key( key );
    var data = this.check_cache( idx );
    if ( data ) {
        chain( data );
    } else {
        var self = this;
        var next = function () {
            data = self.check_cache( idx );
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

JsonpZip.JsonpCache.prototype.queue_task = function ( chain ) {
    if ( ! this._tasklist ) this._tasklist = [];
    this._tasklist.push( chain );
}

//	各タスクを呼び出し、true が返ればタスク終了、false が返れば後で再確認する

JsonpZip.JsonpCache.prototype.check_task = function () {
    if ( ! this._tasklist ) return;
    if ( ! this._tasklist[0] ) this._tasklist.shift();
    for( var i=0; i<this._tasklist.length; i++ ) {
        var next = this._tasklist[i];
        if ( ! next ) continue;
        var stat = next();
        if ( stat ) this._tasklist[i] = null;
    }
}

JsonpZip.JsonpCache.prototype.load_jsonp = function ( src ) {
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

/* ********************************************************* */

JsonpZip.Data = function () { return this; };
JsonpZip.Data.prototype = new JsonpZip.JsonpCache();
JsonpZip.Data.prototype.base_url = function () {
	return JsonpZip.JSONP_BASE;
}
JsonpZip.Data.prototype.url_suffix = function () {
	var suffix = '';
	suffix += '?v='+JsonpZip.VERSION;
	return suffix;
}

/* ********************************************************* */

JsonpZip.Data.Master = function () { return this; };
JsonpZip.Data.ByCity = function () { return this; };
JsonpZip.Data.ByZip  = function () { return this; };
JsonpZip.Data.Master.prototype = new JsonpZip.Data();
JsonpZip.Data.ByCity.prototype = new JsonpZip.Data();
JsonpZip.Data.ByZip.prototype  = new JsonpZip.Data();

JsonpZip.Data.Master.prototype.jsonp_url = function ( idx ) {
	if ( ! idx ) return;
	if ( idx == "" ) return;
	var url = this.base_url();
	url += 'master/'+idx+'.jsonp';
	return url;
};
JsonpZip.Data.ByZip.prototype.jsonp_url = function ( zip7 ) {
	var idx = this.index_key( zip7 );
	if ( ! idx ) return;
	if ( idx == "" ) return;
	var url = this.base_url();
	url += 'zip/zip-'+idx+'.jsonp';
	return url;
};
JsonpZip.Data.ByCity.prototype.jsonp_url = function ( citycd ) {
	var idx = this.index_key( citycd );
	if ( ! idx ) return;
	if ( idx == "" ) return;
	var url = this.base_url();
	var prefcd = idx.substr( 0, 2 ).replace( /[^0-9]+/g, "" );
	url += 'city/pref-'+prefcd+'/city-'+idx+'.jsonp';
	return url;
};
JsonpZip.Data.Master.prototype.index_key = function ( idx ) {
	idx = idx.replace( /[^A-Za-z0-9\-\%]+/g, "" );
	return idx;
};
JsonpZip.Data.ByZip.prototype.index_key = function ( idx ) {
	idx = idx.replace( /[^0-9]+/g, "" );
	idx = idx.substr( 0, 3 );
	return idx;
};
JsonpZip.Data.ByCity.prototype.index_key = function ( idx ) {
	idx = idx.replace( /[^0-9]+/g, "" );
	idx = idx.substr( 0, 5 );
	return idx;
};

/* ********************************************************* */

JsonpZip.master   = new JsonpZip.Data.Master();
JsonpZip.addr2zip = new JsonpZip.Data.ByCity();
JsonpZip.zip2addr = new JsonpZip.Data.ByZip();

/* ********************************************************* */

JsonpZip.Core = function () { return this; };
JsonpZip.Core.prototype = new JsonpZip.Base();

JsonpZip.Core.prototype.get_prefcd_by_addr = function ( chain, pref ) {
	if ( this._pref2prefcd ) {
		var prefcd = this._pref2prefcd[pref];
		return chain( prefcd );
	}
	var idx = 'preflist';
	var self = this;
	var next = function ( data ) {
		self._pref2prefcd = self.list_to_hash( data, 1, 0 );;
		var prefcd = self._pref2prefcd[pref];
		return chain( prefcd );
	};
	JsonpZip.master.load_run( next, idx );
};
JsonpZip.Core.prototype.get_pref_by_prefcd = function ( chain, prefcd ) {
	prefcd -= 0;
	if ( this._prefcd2pref ) {
		var pref = this._prefcd2pref[prefcd];
		return chain( pref );
	}
	var idx = 'preflist';
	var self = this;
	var next = function ( data ) {
		self._prefcd2pref = self.list_to_hash( data, 0, 1 );;
		var pref = self._prefcd2pref[prefcd];
		return chain( pref );
	};
	JsonpZip.master.load_run( next, idx );
};
JsonpZip.Core.prototype.get_preflist = function ( chain ) {
	if ( this._pref_cache ) {
		var list = this._pref_cache;
		return chain( list );
	}
	var idx = 'preflist';
	var self = this;
	var next = function ( data ) {
		var list = self.map_title( data, ['prefcd','pref'] );
		this._pref_cache = list;
		return chain( list );
	};
	JsonpZip.master.load_run( next, idx );
};
JsonpZip.Core.prototype.get_citylist_by_pref = function ( chain, pref ) {
	if ( ! this._city_cache ) this._city_cache = {};
	if ( this._city_cache[pref] ) {
		var list = this._city_cache[pref];
		return chain( list );
	}
	var idx = 'citylist';
	var self = this;
	var next = function ( data ) {
		var array = self.grep_first( data, 1, pref );
		if ( ! array ) return;
		self._city_cache[pref] = self.map_title( array[2], ['citycd','city'] );
		var list = self._city_cache[pref];
		return chain( list );
	};
	JsonpZip.master.load_run( next, idx );
};
JsonpZip.Core.prototype.get_city_by_citycd = function ( chain, citycd ) {
	var idx = 'citylist';
	var self = this;
	var next = function ( data ) {
		for( var i=0; i<data.length; i++ ) {
			var array = self.grep_first( data[i][2], 0, citycd );
			if ( ! array ) return;
//			var prefcd = data[i][0];
			var pref = data[i][1];
			var city = array[1];
			return chain( pref+city );
		}
	};
	JsonpZip.master.load_run( next, idx );
};
JsonpZip.Core.prototype.get_citycd_by_addr = function ( chain, addr ) {
	var idx = 'citylist';
	var self = this;
	var next = function ( data ) {
		for( var i=0; i<data.length; i++ ) {
			var pref = data[i][1];
			if ( pref != addr.substr( 0, pref.length )) continue;
			var rest = addr.substr( pref.length );
			var array = self.match_first( data[i][2], 1, rest );
			if ( array ) return chain( array[0] );
		}
	};
	JsonpZip.master.load_run( next, idx );
};
JsonpZip.Core.prototype.get_addr_by_zipcd = function ( chain, zip7 ) {
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
JsonpZip.Core.prototype.get_addrlist_by_zipcd = function ( chain, zip7 ) {
	var self = this;
	zip7 = zip7.replace( /[^0-9]+/g, "" );
	var next = function ( data ) {
		for( var i=0; i<data.length; i++ ) {
			var array = self.grep_multiple( data[i][3], 0, zip7 );
			if ( ! array ) continue;
			if ( ! array.length ) continue;
			var citycd = data[i][0];
			var pref = data[i][1];
			var city = data[i][2];
			var map = self.map_title( array, ['zip7','area','strt'] );
			for( var i=0; i<map.length; i++ ) {
				map[i].citycd = citycd;
				map[i].pref = pref;
				map[i].city = city;
			}
			return chain( map );
		}
	};
	JsonpZip.zip2addr.load_run( next, zip7 );
};

/* ********************************************************* */

JsonpZip.Core.prototype.get_ziplist_by_addr = function ( chain, addr ) {
	var self = this;
	var next2 = function ( meta ) {
		var pref = meta[1];
		var city = meta[2];
		var rest = addr.substr( pref.length+city.length );
		// 配列中の大字町域名の方が短い。テスト用住所の方が長い
		var array = self.match_first( meta[3], 0, rest );
		if ( ! array ) return;
		// 大字町域名は無視して、郵便番号以降を取り出す
		var ret = array.slice( 1 );
		return chain( ret );
	};
	var next1 = function ( citycd ) {
		self.get_citymeta_by_citycd( next2, citycd );
	};
	this.get_citycd_by_addr( next1, addr );

};
JsonpZip.Core.prototype.get_arealist_by_addr = function ( chain, addr ) {
	var self = this;
	var next2 = function ( meta ) {
		// 市区町村名以外は無視する（前方絞り込みする？）
		var pref = meta[1];
		var city = meta[2];
		var rest = addr.substr( pref.length+city.length );
		// 郵便番号は無視して、大字町域名のみを取り出す
		var array = meta[3];
		var list = [];
		for( var i=0; i<array.length; i++ ) {
			list.push( array[i][0] );
		}
		return chain( list );
	};
	var next1 = function ( citycd ) {
		self.get_citymeta_by_citycd( next2, citycd );
	};
	this.get_citycd_by_addr( next1, addr );
};
JsonpZip.Core.prototype.get_citymeta_by_citycd = function ( chain, citycd ) {
	var next = function ( data ) {
		for( var i=0; i<data.length; i++ ) {
			if ( citycd != data[i][0] ) continue;
			return chain( data[i] );
		}
	};
	JsonpZip.addr2zip.load_run( next, citycd );
};

/* ********************************************************* */

JsonpZip.Element = function ( elem, column, onchange ) {
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
	var self = this;
	var func1 = function () {
		self.onchange( self );
	};
	this.addEventListener( elem, 'change', func1 );
	var maxlen = elem.getAttribute( 'maxlength' );
	if ( this.type_text && maxlen ) {
		var func2 = function () {
			var val = self.get_value();
			if ( val.length != maxlen ) return;
			self.onchange( self );
		};
		self.addEventListener( elem, 'keyup', func2 );
	};
	return this;
};
JsonpZip.Element.prototype = new JsonpZip.Base();
JsonpZip.Element.prototype.init_options = function ( listtxt, listval ) {
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
JsonpZip.Element.prototype.set_value = function ( val ) {
	if ( this.type_select ) return this.set_select_value( val );
	if ( this.type_text ) {
		this.elem.value = val;
//		this.elem.focus();
	}
};
JsonpZip.Element.prototype.get_value = function () {
	if ( this.type_select ) return this.get_select_value();
	if ( this.type_text ) return this.elem.value;
};
JsonpZip.Element.prototype.set_select_value = function ( val ) {
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
JsonpZip.Element.prototype.get_select_value = function () {
	var opt = this.get_option_selected();
	if ( opt ) return opt.value;
};
JsonpZip.Element.prototype.get_option_selected = function () {
    var opts = this.elem.options;
    if ( ! opts ) return;
    for( var i=0; i<opts.length; i++ ) {
        if ( opts[i].selected ) return opts[i];
    }
};

/* ********************************************************* */

JsonpZip.Form = function ( form ) {
	this.form = form;
	this.input = {};
	this.jsonpzip = new JsonpZip.Core();
	var cnt = 0;
	var self = this;
	var onchange = function ( input ) {
		self.onChange( input );
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
			var input = new JsonpZip.Element( elem, column, onchange );
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
JsonpZip.Form.prototype = new JsonpZip.Base();

JsonpZip.Form.prototype.init_preflist = function ( chain ) {
	if ( ! this.input.pref.type_select ) return;
	if ( this.input.pref.default_length > 1 ) return;
	var self = this;
	var next = function ( list ) {
		var txtlist = self.map_column( list, 'pref' );
		self.input.pref.init_options( txtlist, txtlist );
		if ( chain ) chain();
	};
	this.jsonpzip.get_preflist( next );
}

JsonpZip.Form.prototype.init_citylist = function ( chain ) {
	if ( ! this.input.city.type_select ) return;
	if ( this.input.city.default_length > 1 ) return;
	var self = this;
	var next = function ( list ) {
		var txtlist = self.map_column( list, 'city' );
		self.input.city.init_options( txtlist, txtlist );
		if ( chain ) chain();
	};
	var pref = this.input.pref.get_value();
	if ( ! pref ) return next( [] );
	this.jsonpzip.get_citylist_by_pref( next, pref );
}

JsonpZip.Form.prototype.init_arealist = function ( chain ) {
	if ( ! this.input.area.type_select ) return;
	if ( this.input.area.default_length > 1 ) return;
	var self = this;
	var next = function ( list ) {
		self.input.area.init_options( list, list );
		if ( chain ) chain();
	};
	var addr = this.input.city.get_value();
	if ( ! addr ) return next( [] );
	if ( this.input.pref ) addr = this.input.pref.get_value() + addr;
	this.jsonpzip.get_arealist_by_addr( next, addr );
}

// 	フォームに入力されている郵便番号を取得

JsonpZip.Form.prototype.read_zipcd = function () {
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

JsonpZip.Form.prototype.write_zipcd = function ( zip7 ) {
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

JsonpZip.Form.prototype.read_addr = function () {
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

JsonpZip.Form.prototype.write_addr = function ( data ) {
	if ( this.input.pref ) {
		this.input.pref.set_value( data.pref );
	}
	if ( this.input.addr ) {
		var addr = data.city + data.area + data.strt;
		if ( ! this.input.pref ) addr = data.pref + addr;
		this.input.addr.set_value( addr );
//		this.input.addr.elem.focus();
	} else {
		var self = this;
		var next3 = function () {
			if ( self.input.strt ) {
				self.input.strt.set_value( data.strt );
//				self.input.strt.elem.focus();
			} else {
//				self.input.area.elem.focus();
			}
		};
		var next2 = function () {
			if ( self.input.area ) {
				self.write_area( data.area, next3 );
			}
		};
		if ( this.input.city ) {
			this.write_city( data.city, next2 );
		}
	}
};

JsonpZip.Form.prototype.write_strt = function ( strt, chain ) {
	if ( ! this.input.strt ) return;
	this.input.strt.set_value( strt );
	if( chain ) chain();
};

JsonpZip.Form.prototype.write_area = function ( area, chain ) {
	if ( ! this.input.area ) return;
	var self = this;
	var next = function () {
		self.input.area.set_value( area );
		if( chain ) chain();
	};
	if ( this.input.area.type_select ) {
		this.init_arealist( next );
	} else {
		next();
	}
};

JsonpZip.Form.prototype.write_city = function ( city, chain ) {
	if ( ! this.input.city ) return;
	var self = this;
	var next = function () {
		self.input.city.set_value( city );
		if( chain ) chain();
	};
	if ( this.input.city.type_select ) {
		this.init_citylist( next );
	} else {
		next();
	}
};

JsonpZip.Form.prototype.onChange = function ( input, chain ) {
	var self = this;

	// 都道府県が変更になり、かつ市区町村がプルダウン形式の場合、
	// 市区町村のプルダウンを更新してから、再度 onChange を呼び直す

	if ( input.column == 'pref' && this.input.city ) {
		if ( this.input.city.type_select ) {
			var next5 = function () {
				self.onChange( self.input.city, chain );
			};
			return this.init_citylist( next5 );
		}
	}

	// 市区町村が変更になり、かつ大字町域がプルダウン形式の場合、
	// 大字町域のプルダウンを更新してから、再度 onChange を呼び直す

	if ( input.column == 'city' && this.input.area ) {
		if ( this.input.area.type_select ) {
			var next4 = function ( list ) {
				self.onChange( self.input.area, chain );
			};
			return this.init_arealist( next4 );
		}
	}

	var zip7 = this.read_zipcd();
	if ( ! zip7 ) zip7 = "";
	var addr = this.read_addr();
	if ( ! addr ) addr = "";

	// 更新のあったカラム種別が zip3,zip4,zip7 の場合
	// 郵便番号　⇒　住所自動入力

	if ( input.column.substr(0,3) == 'zip' ) {
		// 最終回と同じ（変更がない）場合は無視する
		if ( zip7 == this.last_zipenter ) return;
		this.last_zipenter = zip7;
		// 郵便番号が7桁でない場合は無視する
		if ( zip7.length != 7 ) return;
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
			self.write_addr( data );
			if ( chain ) chain();
		};
		return this.jsonpzip.get_addr_by_zipcd( next1, zip7 );
	}

	// 更新のあったカラム種別が zip3,zip4,zip7 以外の場合
	// 住所　⇒　郵便番号自動入力モード

	else {
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
			self.last_zipauto = newzip7;
			self.write_zipcd( newzip7 );
			if ( chain ) chain();
		};
		return this.jsonpzip.get_ziplist_by_addr( next2, addr );
	}
};

/* ********************************************************* */

JsonpZip.Page = function () {
//	this.list = [];
	this.form = {};
	var list = document.getElementsByTagName( 'form' );
	for( var i=0; i<list.length; i++ ) {
		// ページ内のフォームをそれぞれ確認する（複数フォーム対応）
		var temp = new JsonpZip.Form( list[i] );
		if ( ! temp ) return;
//		this.list.push( temp );
		// 名前付きフォーム <form name="XXXX"> は、JsonpZip.page.form.XXXX でアクセス可能
		if ( list[i].name ) {
			this.form[list[i].name] = temp;
		}
		if ( list[i].id ) {
			this.form[list[i].id] = temp;
		}
	}
//	if ( ! this.list.length ) return;
	return this;
};
JsonpZip.Page.prototype = new JsonpZip.Base();

/* ********************************************************* */
