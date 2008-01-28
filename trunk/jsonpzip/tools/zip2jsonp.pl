#!/usr/bin/perl
# ---------------------------------------------------------------- #
#   郵便番号一覧 CSV ファイルを JSONP ファイルを生成する
#   (c) 2001-2008 Kawasaki Yusuke. All rights reserved.
# ---------------------------------------------------------------- #
    use strict;
    require 5.008;
    use utf8;
    use Encode ();
    use Storable ();
    use URI::Escape qw( uri_escape_utf8 );
    use lib qw( lib );
    use Time::Local ();
#   use JSON;
    use JSON::Syck;
# ---------------------------------------------------------------- #
    my $CSV_ENC   = 'CP932';        # CSVファイルのエンコーディング
    my $DISP_ENC  = 'utf8';         # 表示用のエンコーディング
    my $JSON_ENC  = 'utf8';         # JSONファイルのエンコーディング
    my $CSV_FILE  = 'ken_all.csv';  # 入力元CSVファイル名（デフォルト）
    my $CSV_JIGYO = 'jigyosyo.csv'; # 事業所要郵便番号CSVファイル（オプション）
    my $ZIP2ADDR_JSONP  = '../jsonp/zip/zip-%03d.jsonp';
    my $ADDR2ZIP_JSONP  = '../jsonp/city/pref-%02d/city-%05d.jsonp';
    my $MASTER_JSONP    = '../jsonp/master/%s.jsonp';
    my $ZIP2ADDR_PREFIX = 'JsonpZip.zip2addr.callback';
    my $ADDR2ZIP_PREFIX = 'JsonpZip.addr2zip.callback';
    my $MASTER_PREFIX   = 'JsonpZip.master.callback';
    my $TOOL_VERSION    = '1.1';
    my $DIRMOD = 0755;
# ---------------------------------------------------------------- #
    &main( @ARGV );
# ---------------------------------------------------------------- #
sub main {
    my $kencsv = shift || $CSV_FILE;
    my $jigcsv = shift || $CSV_JIGYO;
    my $kenlist = &parse_ken_all( $kencsv );
    my $jiglist = &parse_jigyosyo( $jigcsv );
#   &write_preflist( $kenlist );
#   &write_citylist( $kenlist );
#   &write_zip2addr( $kenlist, $jiglist );
    &write_addr2zip( $kenlist );
}
# ---------------------------------------------------------------- #
# 読み仮名データの促音・拗音を小書きで表記したもの
# http://www.post.japanpost.jp/zipcode/dl/kogaki.html
# http://www.post.japanpost.jp/zipcode/dl/kogaki/lzh/ken_all.lzh
# ---------------------------------------------------------------- #
sub parse_ken_all {
    my $csvfile = shift;
    my $prev    = "";
    my $przip   = "";
    my $c       = 0;
    my $list    = [];

    print STDERR "**** $csvfile ****\n";
    my $cache = &read_csv_cache( $csvfile );
    return $cache if ref $cache;

    open( CSV, $csvfile ) or die "$! - $csvfile\n";
    while ( my $iline = <CSV> ) {
        last if ( $iline =~ /^\x1a/ );  # EOF

        # UTF-8コードで処理する
        $iline = Encode::decode( $CSV_ENC, $iline );

        # CSVとはいっても「,」の文字は住所には利用されていないので簡易処理
        my @r = split( ",", $iline );
        s/^"(.*)"$/$1/s foreach ( @r );

        # 第1・3・10・15カラムは、確実に数字のみのハズ
        if ( $r[0]  !~ m#^\d{5}$# ||
             $r[2]  !~ m#^\d{7}$# ||
             $r[9]  !~ m#^\d{1}$# ||
             $r[14] !~ m#^\d{1}[\r\n]+$# ) {
            die "Invalid Data Source: $csvfile (ken_all.csv)\n$iline\n";
        }

        # 岩手県    和賀郡西和賀町  杉名畑４４地割
        # 岩手県    和賀郡西和賀町  穴明２２地割、穴明２３地割
        # 岩手県    九戸郡洋野町    種市第１５地割～第２１地割
        $r[8] =~ s/(第)?(０|１|２|３|４|５|６|７|８|９)+地割.*$//s;

        #『以下に掲載がない場合』等の場合、大字全体を無視してしまう
        if ( $r[8] =~ /(^以下に掲載がない場合
                        |の次に番地がくる場合
                        |一円
                        )$/xs ) {
            $r[8] = "";
        }

        # 『（』がないのに『、』か『）』が入るレコードも無視
        if ( $r[8] =~ /^[^（]+[、）]/ ) {
            # かつ、前の郵便番号のレコードの続きの場合のみ
            next if ( $przip eq $r[2] );
        }
        $przip = $r[2];

        # 記録
        push( @$list, \@r );

        # 都道府県が変わったら、画面に都道府県名を表示する
        my $pref = int($r[0]/1000);
        if ( $prev ne $pref ) {
            $prev = $pref;
            print STDERR " $c lines\n" if $c;
            my $v = sprintf( "%s  \t", $r[6] );
            $v = Encode::encode( $DISP_ENC, $v );
            print STDERR $v;
            $c = 0;
        }
        print STDERR "." if ( $c ++ % 200 == 0 );
    }
    print STDERR " $c areas\n" if ( $c > 0 );
    close( CSV );

    &write_csv_cache( $list, $csvfile );
    $list;
}
# ---------------------------------------------------------------- #
# 事業所の個別郵便番号
# http://www.post.japanpost.jp/zipcode/dl/jigyosyo/index.html
# http://www.post.japanpost.jp/zipcode/dl/jigyosyo/lzh/jigyosyo.lzh
# ---------------------------------------------------------------- #
sub parse_jigyosyo {
    my $csvfile = shift or return;
    my $prev    = "";
    my $c       = 0;
    my $list    = [];

    return unless ( -f $csvfile );

    print STDERR "**** $csvfile ****\n";
    my $cache = &read_csv_cache( $csvfile );
    return $cache if ref $cache;

    open( JIGYO, $csvfile ) or die "$! - $csvfile\n";
    while ( my $iline = <JIGYO> ) {
        last if ( $iline =~ /^\x1a/ );  # EOF

        # UTF-8コードで処理する
        $iline = Encode::decode( $CSV_ENC, $iline );

        # CSVとはいっても「,」の文字は住所には利用されていないので簡易処理
        my @r = split( ",", $iline );
        s/^"(.*)"$/$1/s foreach ( @r );

        # 第1・8・11・13カラムは、確実に数字のみのハズ
        if ( $r[0]  !~ m#^\d{5}$# ||
             $r[7]  !~ m#^\d{7}$# ||
             $r[10] !~ m#^\d{1}$# ||
             $r[12] !~ m#^\d{1}[\r\n]+$# ) {
            die "Invalid Data Source: $csvfile (jigyosyo.csv)\n$iline\n";
        }

        # 全角かっこ『（）』や『１Ｆ～９Ｆ』を削除
        $r[6] =~ s/（.*）$//s;
        $r[6] =~ s/(－)?((０|１|２|３|４|５|６|７|８|９)+(Ｆ|階|～|、)+)+
                   (０|１|２|３|４|５|６|７|８|９)+(Ｆ|階)$//sx;

        # 記録
        push( @$list, \@r );

        # 都道府県が変わったら、画面に都道府県名を表示する
        my $pref = int($r[0]/1000);
        if ( $prev ne $pref ) {
            $prev = $pref;
            print STDERR " $c lines\n" if $c;
            my $v = sprintf( "%s  \t", $r[3] );
            $v = Encode::encode( $DISP_ENC, $v );
            print STDERR $v;
            $c = 0;
        }
        print STDERR "." if ( $c ++ % 200 == 0 );
    }
    print STDERR " $c spots\n" if ( $c > 0 );
    close( JIGYO );

    &write_csv_cache( $list, $csvfile );
    $list;
}
# ---------------------------------------------------------------- #
sub write_zip2addr {
    my $kenlist = shift or return;
    my $jiglist = shift || [];
    my $check = {};
    my $work  = {};

    print STDERR "**** zip2addr ****\n";

    # 都道府県ID・市町村名・町域名をハッシュに変換

    my $e = 0;
    foreach my $line ( @$kenlist ) {
        my( $citcd, undef, $zip7, undef, undef, undef, $pref, $city, $area ) = @$line;

        #『西新宿新宿アイランドタワー（１階）』等のレコードは、階番号を生かす
        $area =~ s/（((０|１|２|３|４|５|６|７|８|９)+階)）$/$1/;

        # 全角開きカッコ『（』以降を削除
        $area =~ s/（.*$//s;

        # 『（』がないのに『、』か『）』が入る大字を無視
        $area = "" if ( $area =~ /[、）]/ );
        next if $check->{$citcd.$area.$zip7} ++;
        
        my $zip3 = ( $zip7 =~ /^(\d{3})/ )[0];
        $work->{$zip3} ||= {};
        $work->{$zip3}->{$citcd} ||= [ $citcd, $pref, $city, [] ];

        my $array = [ $zip7, $area ];
        push( @{$work->{$zip3}->{$citcd}->[3]}, $array );
        print STDERR "." if ( $e ++ % 2000 == 0 );
    }
    print STDERR " $e areas\n" if ( $e > 0 );

    # 都道府県ID・市町村名・町域名・番地をハッシュに変換

    my $d = 0;
    foreach my $line ( @$jiglist ) {
        my( $citcd, undef, undef, $pref, $city, $area, $strt, $zip7 ) = @$line;
        next if $check->{$citcd.$area.$strt.$zip7} ++;
        my $zip3 = ( $zip7 =~ /^(\d{3})/ )[0];
        $work->{$zip3} ||= {};
        $work->{$zip3}->{$citcd} ||= [ $citcd, $pref, $city, [] ];

        my $array = [ $zip7, $area, $strt ];
        push( @{$work->{$zip3}->{$citcd}->[3]}, $array );
        print STDERR "." if ( $d ++ % 2000 == 0 );
    }
    print STDERR " $d spots\n" if ( $d > 0 );

    # 構造変換

    my $out   = {};
    my $FIX = 'FIX';
    foreach my $zip3 ( keys %$work ) {
        $out->{$FIX} ||= {};
        $out->{$FIX}->{$zip3} = [ values %{$work->{$zip3}} ];
	}

    # JSON.pm と JSON::Syck を確認する

    my $use_syck = $JSON::Syck::VERSION;
    my $use_json = $JSON::VERSION unless $use_syck;
    my $new_json = (( $use_json =~ /^([\d\.]+)/ )[0] >= 2.0 ) if $use_json;
    print STDERR "module: \tJSON.pm ($use_json)\n" if $use_json;
    print STDERR "module: \tJSON::Syck ($use_syck)\n" if $use_syck;

    # 郵便番号上位3桁ごとにJSONファイルに書き出していく

    my $prev = "";
    my $c    = 0;
    foreach my $level1 ( sort keys %$out ) {
        my $child = $out->{$level1} or next;
        foreach my $level2 ( sort keys %$child ) {
            my $data = $child->{$level2} or next;
            my $dump = $use_syck ? JSON::Syck::Dump($data) :
                       $new_json ? to_json($data) : objToJson($data);
            $dump = Encode::encode( $JSON_ENC, $dump ) if $new_json;

            # JSONPファイルに書き出す
            my $jsonpfile = sprintf( $ZIP2ADDR_JSONP, $level2 );
            print STDERR "jsonp:  \t$jsonpfile\n" unless $c;
            &check_mkdir( $jsonpfile );
            my $index = Encode::encode( $JSON_ENC, $level2 );
            my $script = "$ZIP2ADDR_PREFIX({index:'$index',ver:'$TOOL_VERSION',data:\n$dump\n});\n";
            &write_file( $jsonpfile, $script );

            print STDERR "." if ( $c ++ % 200 == 0 );
        }
    }
    print STDERR " $c files\n";
}
# ---------------------------------------------------------------- #
sub write_addr2zip {
    my $kenlist = shift or return;
    my $jiglist = shift || [];
    my $check = {};

    print STDERR "**** addr2zip ****\n";

    my $e = 0;
    my $work  = {};
    my $harea = {};
    foreach my $line ( @$kenlist ) {
        my( $citcd, undef, $zip7, undef, undef, undef, $pref, $city, $area ) = @$line;
        # 大字が undef（以下に掲載がない場合、番地が来る場合、一円）なら諦める
        next unless defined $area;
        #『西新宿新宿アイランドタワー（地階・階層不明）』等のレコードは無視
        next if ( $area =~ /（(０|１|２|３|４|５|６|７|８|９|地)+階/ );
        # その他の全角開きカッコ『（』以降を削除
        $area =~ s/（.*$//s;
        # 『、』か『）』が入るレコードも無視
        next if ( $area =~ /[、）]/ );
        next if $check->{$citcd.$area.$zip7} ++;

        $work->{$citcd} ||= [ $citcd, $pref, $city, [] ];

		if ( ! ref $harea->{$citcd.$area} ) {
			my $aarray = [ $area, $zip7 ];
			$harea->{$citcd.$area} = $aarray;
			push( @{$work->{$citcd}->[3]}, $aarray );
		} else {
			push( @{$harea->{$citcd.$area}}, $zip7 );
		}
        print STDERR "." if ( $e ++ % 2000 == 0 );
    }
    print STDERR " $e areas\n" if ( $e > 0 );

    # 複数の住所がある市では、大字が空のものを除去する

    foreach my $barray ( values %$work ) {
    	my $carray = $barray->[3];
        next if ( 1 == scalar @$carray );
        next unless grep { $_->[0] eq "" } @$carray;
        @$carray = grep { $_->[0] ne "" } @$carray;
    }

    # 構造変換

    my $out   = {};
    foreach my $citcd ( keys %$work ) {
    	my $prefcd = ( $citcd =~ /^(\d{2})/ )[0] or next;
        $out->{$prefcd} ||= {};
        $out->{$prefcd}->{$citcd} = [ $work->{$citcd} ];
	}

    # JSON.pm と JSON::Syck を確認する

    my $use_syck = $JSON::Syck::VERSION;
    my $use_json = $JSON::VERSION unless $use_syck;
    my $new_json = (( $use_json =~ /^([\d\.]+)/ )[0] >= 2.0 ) if $use_json;
    print STDERR "module: \tJSON.pm ($use_json)\n" if $use_json;
    print STDERR "module: \tJSON::Syck ($use_syck)\n" if $use_syck;

    # 住所の先頭５文字ごとにJSONファイルに書き出していく

    my $c = 0;
    foreach my $level1 ( sort keys %$out ) {
        my $child = $out->{$level1} or next;
        foreach my $level2 ( sort keys %$child ) {
            my $data = $child->{$level2} or next;
            my $dump = $use_syck ? JSON::Syck::Dump($data) :
                       $new_json ? to_json($data) : objToJson($data);
            $dump = Encode::encode( $JSON_ENC, $dump ) if $new_json;

            # JSONPファイルに書き出す
            my $jsonpfile = sprintf( $ADDR2ZIP_JSONP, $level1, $level2 );
            print STDERR "jsonp:  \t$jsonpfile\n" unless $c;
            &check_mkdir( $jsonpfile );
            my $index = Encode::encode( $JSON_ENC, $level2 );
            my $script = "$ADDR2ZIP_PREFIX({index:'$index',ver:'$TOOL_VERSION',data:\n$dump\n});\n";
            &write_file( $jsonpfile, $script );

            print STDERR "." if ( $c ++ % 200 == 0 );
        }
    }
    print STDERR " $c files\n";
}
# ---------------------------------------------------------------- #
sub write_citylist {
    my $kenlist = shift or return;
    my $data    = [];
    my $hcity   = {};
    my $hpref   = {};

    print STDERR "**** citylist ****\n";

    my $e = 0;
    foreach my $line ( @$kenlist ) {
        my( $citcd, undef, undef, undef, undef, undef, $pref, $city ) = @$line;
        next if $hcity->{$citcd} ++;
        my $precd = int($citcd/1000);
        my $carray = [ "$citcd", $city ];
        if ( ref $hpref->{$precd} ) {
            push( @{$hpref->{$precd}}, $carray );
        } else {
            my $varray = [ $carray ];
            $hpref->{$precd} = $varray;
            my $parray = [ $precd, $pref, $varray ];
            push( @$data, $parray );
        }
        print STDERR "." if ( $e ++ % 200 == 0 );
    }
    print STDERR " $e areas\n" if ( $e > 0 );

    # JSON.pm と JSON::Syck を確認する

    my $use_syck = $JSON::Syck::VERSION;
    my $use_json = $JSON::VERSION unless $use_syck;
    my $new_json = (( $use_json =~ /^([\d\.]+)/ )[0] >= 2.0 ) if $use_json;
    print STDERR "module: \tJSON.pm ($use_json)\n" if $use_json;
    print STDERR "module: \tJSON::Syck ($use_syck)\n" if $use_syck;

    my $dump = $use_syck ? JSON::Syck::Dump($data) :
               $new_json ? to_json($data) : objToJson($data);
    $dump = Encode::encode( $JSON_ENC, $dump ) if $new_json;
    my $index = 'citylist';

    # JSONPファイルに書き出す
    my $jsonpfile = sprintf( $MASTER_JSONP, $index );
    print STDERR "jsonp:  \t$jsonpfile\n";
    &check_dir( $jsonpfile );
    my $script = "$MASTER_PREFIX({index:'$index',ver:'$TOOL_VERSION',data:\n$dump\n});\n";
    &write_file( $jsonpfile, $script );
}
# ---------------------------------------------------------------- #
sub write_preflist {
    my $kenlist = shift or return;
    my $data  = [];
    my $hpref = {};

    print STDERR "**** preflist ****\n";

    my $e = 0;
    foreach my $line ( @$kenlist ) {
        my( $citcd, undef, undef, undef, undef, undef, $pref ) = @$line;
        my $precd = int($citcd/1000);
        next if $hpref->{$precd} ++;
#       $city =~ s/市.*区$/市/;
        my $array = [ $precd, $pref ];
        push( @$data, $array );
        print STDERR ".";
        $e ++;
    }
    print STDERR " $e areas\n" if ( $e > 0 );

    # JSON.pm と JSON::Syck を確認する

    my $use_syck = $JSON::Syck::VERSION;
    my $use_json = $JSON::VERSION unless $use_syck;
    my $new_json = (( $use_json =~ /^([\d\.]+)/ )[0] >= 2.0 ) if $use_json;
    print STDERR "module: \tJSON.pm ($use_json)\n" if $use_json;
    print STDERR "module: \tJSON::Syck ($use_syck)\n" if $use_syck;

    my $dump = $use_syck ? JSON::Syck::Dump($data) :
               $new_json ? to_json($data) : objToJson($data);
    $dump = Encode::encode( $JSON_ENC, $dump ) if $new_json;
    my $index = 'preflist';

    # JSONPファイルに書き出す
    my $jsonpfile = sprintf( $MASTER_JSONP, $index );
    print STDERR "jsonp:  \t$jsonpfile\n";
    &check_dir( $jsonpfile );
    my $script = "$MASTER_PREFIX({index:'$index',ver:'$TOOL_VERSION',data:\n$dump\n});\n";
    &write_file( $jsonpfile, $script );
}
# ---------------------------------------------------------------- #
sub check_dir {
    my $file = shift;
    my $dir  = ( $file =~ m#^(.*/)[^/]+$# )[0] or return;
    die "$! - $dir\n" unless ( -d $dir );
}
sub check_mkdir {
    my $file = shift;
    my $dir  = ( $file =~ m#^(.*/)[^/]+$# )[0] or return;
    return if ( -d $dir );
    mkdir( $dir, $DIRMOD ) or die "$! - $dir\n";
}
sub write_file {
    my $file = shift or return;
    my $text = shift;
    open( OUT, "> $file" ) or die "$! - $file\n";
    print OUT $text, "\n";
    close( OUT );
}
sub read_csv_cache {
    my $csvfile = shift or return;
    my $store   = $csvfile;
    $store =~ s/\.csv$/.store/i or return;
    return unless ( -r $store );
    print STDERR "Loading-Cache:\t$store\n";
    Storable::retrieve( $store );
}
sub write_csv_cache {
    my $data    = shift or return;
    my $csvfile = shift or return;
    my $store   = $csvfile;
    $store =~ s/\.csv$/.store/i or return;
    print STDERR "Writing-Cache:\t$store\n";
    Storable::store( $data, $store );
}
sub epoch_to_w3cdtf {
    my $epoch = shift || time();
    my ( $sec, $min, $hour, $day, $mon, $year ) = gmtime($epoch);
    $year += 1900;
    $mon++;
    sprintf( '%04d-%02d-%02dT%02d:%02d:%02dZ',
        $year, $mon, $day, $hour, $min, $sec );
}
# ---------------------------------------------------------------- #
;1;
# ---------------------------------------------------------------- #
