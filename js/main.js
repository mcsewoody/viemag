/* ============================================================
   VIEMAG — site engine
   i18n runtime · shared header/footer · SVG art · renderers
   ============================================================ */
(function () {
  'use strict';
  const DB = window.DB, DICT = window.I18N_DICT;
  const LANGS = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'vi', label: 'Tiếng Việt', short: 'VI' },
    { code: 'id', label: 'Bahasa Indonesia', short: 'ID' },
    { code: 'zh-Hans', label: '简体中文', short: '简' },
    { code: 'zh', label: '繁體中文', short: '繁' }
  ];
  const SUPPORTED = LANGS.map((l) => l.code);

  /* Traditional→Simplified char map (generated offline via OpenCC tw→cn).
     zh (Traditional) is the writing base. zh-Hans is INDEPENDENT: a hand-tunable
     override (see DICT['zh-Hans'] in i18n.js, or a `zh-Hans` field on a data object)
     wins verbatim; any key/field with no override auto-converts from zh via toSimp().
     So the seed is editable without being clobbered, and new zh content still shows
     up Simplified for free. */
  /* Traditional→Simplified character table, generated from the official OpenCC
     TSCharacters dictionary (3223 single-char mappings) rather than hand-listed.
     The previous hand-built map held 246 entries seeded from one snapshot of the
     content, so every new Traditional character an editor typed in /admin leaked
     through unconverted — e.g. 鋁 萬 摺 駕 駛 錄 侶 were all rendering as
     Traditional on the Simplified pages. Stored as a flat "傳簡傳簡…" pair string
     because an object literal costs roughly double the bytes.
     ONE deliberate deviation from OpenCC is preserved: 著→着 (OpenCC leaves it
     context-dependent; this site always wants 着). */
  const T2S = (() => {
    /* Flat "traditional,simplified,…" pairs. All entries are BMP-only and the
       loop steps by code point, because 293 rare CJK-extension characters in the
       source dictionary are surrogate pairs — those count as 1 char in the build
       script but 2 UTF-16 units in JS, which silently misaligned every pair after
       the first one and turned the whole table into garbage (合 mapped to 閥). */
    const p = Array.from("㑯㑔㑳㑇㑶㐹㓨刾㘚㘎㜄㚯㜏㛣㠏㟆㥮㤘㩜㨫㩳㧐㩵擜䁻䀥䃮鿎䊷䌶䋙䌺䋚䌻䋹䌿䋻䌾䍦䍠䎱䎬䙡䙌䜀䜧䝼䞍䥇䦂䥑鿏䥱䥾䦛䦶䦟䦷䯀䯅䰾鲃䱷䲣䱽䲝䲁鳚䲘鳤䴉鹮丟丢並并乾干亂乱亙亘亞亚佇伫佈布佔占併并來来侖仑侶侣侷局俁俣係系俔伣俠侠俥伡俬私倀伥倆俩倈俫倉仓個个們们倖幸倫伦倲㑈偉伟偑㐽側侧偵侦偽伪傌㐷傑杰傖伧傘伞備备傢家傭佣傯偬傳传傴伛債债傷伤傾倾僂偻僅仅僉佥僑侨僕仆僞伪僥侥僨偾僱雇價价儀仪儁俊儂侬億亿儈侩儉俭儎傤儐傧儔俦儕侪儘尽償偿優优儲储儷俪儸㑩儺傩儻傥儼俨兇凶兌兑兒儿兗兖內内兩两冊册冑胄冪幂凈净凍冻凜凛凱凯別别刪删剄刭則则剋克剎刹剗刬剛刚剝剥剮剐剴剀創创剷铲劃划劄札劇剧劉刘劊刽劌刿劍剑劏㓥劑剂劚㔉勁劲動动務务勛勋勝胜勞劳勢势勩勚勱劢勳勋勵励勸劝勻匀匭匦匯汇匱匮區区協协卹恤卻却卽即厙厍厠厕厤历厭厌厲厉厴厣參参叄叁叢丛吒咤吳吴吶呐呂吕咼呙員员唄呗唸念問问啓启啞哑啟启啢唡喎㖞喚唤喪丧喫吃喬乔單单喲哟嗆呛嗇啬嗊唝嗎吗嗚呜嗩唢嗶哔嘆叹嘍喽嘓啯嘔呕嘖啧嘗尝嘜唛嘩哗嘮唠嘯啸嘰叽嘵哓嘸呒嘽啴噁恶噓嘘噚㖊噝咝噠哒噥哝噦哕噯嗳噲哙噴喷噸吨噹当嚀咛嚇吓嚌哜嚐尝嚕噜嚙啮嚥咽嚦呖嚨咙嚮向嚲亸嚳喾嚴严嚶嘤囀啭囁嗫囂嚣囅冁囈呓囉啰囌苏囑嘱囪囱圇囵國国圍围園园圓圆圖图團团垻坝埡垭埰采執执堅坚堊垩堖垴堝埚堯尧報报場场塊块塋茔塏垲塒埘塗涂塚冢塢坞塤埙塵尘塹堑墊垫墜坠墮堕墰坛墳坟墶垯墻墙墾垦壇坛壋垱壎埙壓压壘垒壙圹壚垆壜坛壞坏壟垄壠垅壢坜壩坝壪塆壯壮壺壶壼壸壽寿夠够夢梦夥伙夾夹奐奂奧奥奩奁奪夺奬奖奮奋奼姹妝妆姍姗姦奸娛娱婁娄婦妇婭娅媧娲媯妫媰㛀媼媪媽妈嫋袅嫗妪嫵妩嫺娴嫻娴嫿婳嬀妫嬃媭嬈娆嬋婵嬌娇嬙嫱嬡嫒嬤嬷嬪嫔嬰婴嬸婶孃娘孋㛤孌娈孫孙學学孿孪宮宫寀采寢寝實实寧宁審审寫写寬宽寵宠寶宝將将專专尋寻對对導导尷尴屆届屍尸屓屃屜屉屢屡層层屨屦屬属岡冈峯峰峴岘島岛峽峡崍崃崑昆崗岗崙仑崢峥崬岽嵐岚嵗岁嵾㟥嶁嵝嶄崭嶇岖嶔嵚嶗崂嶠峤嶢峣嶧峄嶨峃嶮崄嶸嵘嶺岭嶼屿嶽岳巋岿巒峦巔巅巖岩巰巯巹卺帥帅師师帳帐帶带幀帧幃帏幓㡎幗帼幘帻幟帜幣币幫帮幬帱幷并幹干幾几庫库廁厕廂厢廄厩廈厦廎庼廕荫廚厨廝厮廟庙廠厂廡庑廢废廣广廩廪廬庐廳厅弒弑弔吊弳弪張张強强彆别彈弹彌弥彎弯彔录彙汇彠彟彥彦彫雕彲彨彿佛後后徑径從从徠徕復复徵征徹彻恆恒恥耻悅悦悞悮悵怅悶闷悽凄惡恶惱恼惲恽惻恻愛爱愜惬愨悫愴怆愷恺愾忾慄栗態态慍愠慘惨慚惭慟恸慣惯慤悫慪怄慫怂慮虑慳悭慶庆慺㥪慼戚慾欲憂忧憊惫憐怜憑凭憒愦憖慭憚惮憤愤憫悯憮怃憲宪憶忆懇恳應应懌怿懍懔懞蒙懟怼懣懑懤㤽懨恹懲惩懶懒懷怀懸悬懺忏懼惧懾慑戀恋戇戆戔戋戧戗戩戬戰战戱戯戲戏戶户扞捍拋抛拚拼挩捝挱挲挾挟捨舍捫扪捱挨捲卷掃扫掄抡掆㧏掗挜掙挣掛挂採采揀拣揚扬換换揮挥揯搄損损搖摇搗捣搧扇搵揾搶抢摑掴摜掼摟搂摯挚摳抠摶抟摺折摻掺撈捞撏挦撐撑撓挠撝㧑撟挢撣掸撥拨撫抚撲扑撳揿撻挞撾挝撿捡擁拥擄掳擇择擊击擋挡擓㧟擔担據据擠挤擡抬擣捣擬拟擯摈擰拧擱搁擲掷擴扩擷撷擺摆擻擞擼撸擽㧰擾扰攄摅攆撵攏拢攔拦攖撄攙搀攛撺攜携攝摄攢攒攣挛攤摊攪搅攬揽敎教敓敚敗败敘叙敵敌數数斂敛斃毙斆敩斕斓斬斩斷断於于旂旗旣既昇升時时晉晋晝昼暈晕暉晖暘旸暢畅暫暂曄晔曆历曇昙曉晓曏向曖暧曠旷曨昽曬晒書书會会朧胧朮术東东枴拐柵栅柺拐査查桿杆梔栀梘枧條条梟枭梲棁棄弃棊棋棖枨棗枣棟栋棡㭎棧栈棲栖棶梾椏桠椲㭏楊杨楓枫楨桢業业極极榘矩榦干榪杩榮荣榲榅榿桤構构槍枪槓杠槤梿槧椠槨椁槮椮槳桨槶椢槼椝樁桩樂乐樅枞樑梁樓楼標标樞枢樢㭤樣样樧榝樫㭴樳桪樸朴樹树樺桦樿椫橈桡橋桥機机橢椭橫横檁檩檉柽檔档檜桧檟槚檢检檣樯檮梼檯台檳槟檸柠檻槛櫃柜櫓橹櫚榈櫛栉櫝椟櫞橼櫟栎櫥橱櫧槠櫨栌櫪枥櫫橥櫬榇櫱蘖櫳栊櫸榉櫻樱欄栏欅榉權权欏椤欒栾欖榄欞棂欽钦歎叹歐欧歟欤歡欢歲岁歷历歸归歿殁殘残殞殒殤殇殨㱮殫殚殭僵殮殓殯殡殰㱩殲歼殺杀殻壳殼壳毀毁毆殴毿毵氂牦氈毡氌氇氣气氫氢氬氩氳氲氾泛汎泛汙污決决沒没沖冲況况泝溯洩泄洶汹浹浃涇泾涗涚涼凉淒凄淚泪淥渌淨净淩凌淪沦淵渊淶涞淺浅渙涣減减渢沨渦涡測测渾浑湊凑湞浈湧涌湯汤溈沩準准溝沟溫温溮浉溳涢溼湿滄沧滅灭滌涤滎荥滙汇滬沪滯滞滲渗滷卤滸浒滻浐滾滚滿满漁渔漊溇漚沤漢汉漣涟漬渍漲涨漵溆漸渐漿浆潁颍潑泼潔洁潙沩潚㴋潛潜潤润潯浔潰溃潷滗潿涠澀涩澆浇澇涝澐沄澗涧澠渑澤泽澦滪澩泶澮浍澱淀澾㳠濁浊濃浓濄㳡濕湿濘泞濚溁濛蒙濜浕濟济濤涛濧㳔濫滥濰潍濱滨濺溅濼泺濾滤瀂澛瀅滢瀆渎瀇㲿瀉泻瀋沈瀏浏瀕濒瀘泸瀝沥瀟潇瀠潆瀦潴瀧泷瀨濑瀰弥瀲潋瀾澜灃沣灄滠灑洒灕漓灘滩灝灏灡㳕灣湾灤滦灧滟灩滟災灾為为烏乌烴烃無无煉炼煒炜煙烟煢茕煥焕煩烦煬炀煱㶽熅煴熒荧熗炝熱热熲颎熾炽燁烨燈灯燉炖燒烧燙烫燜焖營营燦灿燬毁燭烛燴烩燶㶶燻熏燼烬燾焘爍烁爐炉爛烂爭争爲为爺爷爾尔牀床牆墙牘牍牴抵牽牵犖荦犛牦犢犊犧牺狀状狹狭狽狈猙狰猶犹猻狲獁犸獃呆獄狱獅狮獎奖獨独獪狯獫猃獮狝獰狞獱㺍獲获獵猎獷犷獸兽獺獭獻献獼猕玀猡現现琱雕琺珐琿珲瑋玮瑒玚瑣琐瑤瑶瑩莹瑪玛瑲玱璉琏璡琎璣玑璦瑷璫珰璯㻅環环璵玙璸瑸璽玺璿璇瓊琼瓏珑瓔璎瓚瓒甌瓯甕瓮產产産产畝亩畢毕畫画異异畵画當当疇畴疊叠痙痉痠酸痾疴瘂痖瘋疯瘍疡瘓痪瘞瘗瘡疮瘧疟瘮瘆瘲疭瘺瘘瘻瘘療疗癆痨癇痫癉瘅癒愈癘疠癟瘪癡痴癢痒癤疖癥症癧疬癩癞癬癣癭瘿癮瘾癰痈癱瘫癲癫發发皁皂皚皑皰疱皸皲皺皱盃杯盜盗盞盏盡尽監监盤盘盧卢盪荡眞真眥眦眾众睏困睜睁睞睐瞘眍瞜䁖瞞瞒瞶瞆瞼睑矇蒙矓眬矚瞩矯矫硃朱硜硁硤硖硨砗硯砚碕埼碩硕碭砀碸砜確确碼码碽䂵磑硙磚砖磠硵磣碜磧碛磯矶磽硗磾䃅礄硚礎础礙碍礦矿礪砺礫砾礬矾礱砻祕秘祿禄禍祸禎祯禕祎禡祃禦御禪禅禮礼禰祢禱祷禿秃秈籼稅税稈秆稏䅉稜棱稟禀種种稱称穀谷穇䅟穌稣積积穎颖穠秾穡穑穢秽穩稳穫获穭穞窩窝窪洼窮穷窯窑窵窎窶窭窺窥竄窜竅窍竇窦竈灶竊窃竪竖競竞筆笔筍笋筧笕筴䇲箇个箋笺箏筝箚札節节範范築筑篋箧篔筼篠筿篤笃篩筛篳筚簀箦簍篓簑蓑簞箪簡简簣篑簫箫簹筜簽签簾帘籃篮籌筹籔䉤籙箓籛篯籜箨籟籁籠笼籤签籩笾籪簖籬篱籮箩籲吁粵粤糉粽糝糁糞粪糧粮糰团糲粝糴籴糶粜糹纟糾纠紀纪紂纣約约紅红紆纡紇纥紈纨紉纫紋纹納纳紐纽紓纾純纯紕纰紖纼紗纱紘纮紙纸級级紛纷紜纭紝纴紡纺紬䌷紮扎細细紱绂紲绁紳绅紵纻紹绍紺绀紼绋紿绐絀绌終终絃弦組组絅䌹絆绊絎绗結结絕绝絛绦絝绔絞绞絡络絢绚給给絨绒絰绖統统絲丝絳绛絶绝絹绢綁绑綃绡綆绠綈绨綉绣綌绤綏绥綐䌼綑捆經经綜综綞缍綠绿綢绸綣绻綫线綬绶維维綯绹綰绾綱纲網网綳绷綴缀綵彩綸纶綹绺綺绮綻绽綽绰綾绫綿绵緄绲緇缁緊紧緋绯緑绿緒绪緓绬緔绱緗缃緘缄緙缂線线緝缉緞缎締缔緡缗緣缘緦缌編编緩缓緬缅緯纬緱缑緲缈練练緶缏緹缇緻致緼缊縈萦縉缙縊缢縋缒縐绉縑缣縕缊縗缞縛缚縝缜縞缟縟缛縣县縧绦縫缝縭缡縮缩縱纵縲缧縳䌸縴纤縵缦縶絷縷缕縹缥總总績绩繃绷繅缫繆缪繒缯織织繕缮繚缭繞绕繡绣繢缋繩绳繪绘繫系繭茧繮缰繯缳繰缲繳缴繸䍁繹绎繼继繽缤繾缱繿䍀纇颣纈缬纊纩續续纍累纏缠纓缨纔才纖纤纘缵纜缆缽钵罃䓨罈坛罌罂罎坛罰罚罵骂罷罢羅罗羆罴羈羁羋芈羣群羥羟羨羡義义羶膻習习翫玩翬翚翹翘翽翙耬耧耮耢聖圣聞闻聯联聰聪聲声聳耸聵聩聶聂職职聹聍聽听聾聋肅肃脅胁脈脉脛胫脣唇脩修脫脱脹胀腎肾腖胨腡脶腦脑腫肿腳脚腸肠膃腽膕腘膚肤膞䏝膠胶膩腻膽胆膾脍膿脓臉脸臍脐臏膑臘腊臚胪臟脏臠脔臢臜臥卧臨临臺台與与興兴舉举舊旧舖铺舘馆艙舱艤舣艦舰艫舻艱艰艷艳芻刍苧苎茲兹荊荆莊庄莖茎莢荚莧苋華华菴庵菸烟萇苌萊莱萬万萴荝萵莴葉叶葒荭著着葤荮葦苇葯药葷荤蒐搜蒓莼蒔莳蒕蒀蒞莅蒼苍蓀荪蓆席蓋盖蓮莲蓯苁蓴莼蓽荜蔔卜蔘参蔞蒌蔣蒋蔥葱蔦茑蔭荫蕁荨蕆蒇蕎荞蕒荬蕓芸蕕莸蕘荛蕢蒉蕩荡蕪芜蕭萧蕷蓣薀蕰薈荟薊蓟薌芗薑姜薔蔷薘荙薟莶薦荐薩萨薳䓕薴苧薵䓓薹苔薺荠藍蓝藎荩藝艺藥药藪薮藭䓖藴蕴藶苈藹蔼藺蔺蘀萚蘄蕲蘆芦蘇苏蘊蕴蘋苹蘚藓蘞蔹蘢茏蘭兰蘺蓠蘿萝虆蔂處处虛虚虜虏號号虧亏虯虬蛺蛱蛻蜕蜆蚬蝕蚀蝟猬蝦虾蝨虱蝸蜗螄蛳螞蚂螢萤螮䗖螻蝼螿螀蟄蛰蟈蝈蟎螨蟣虮蟬蝉蟯蛲蟲虫蟶蛏蟻蚁蠁蚃蠅蝇蠆虿蠍蝎蠐蛴蠑蝾蠔蚝蠟蜡蠣蛎蠨蟏蠱蛊蠶蚕蠻蛮衆众衊蔑術术衕同衚胡衛卫衝冲袞衮袷夹裊袅裏里補补裝装裡里製制複复褌裈褘袆褲裤褳裢褸褛褻亵襇裥襉裥襏袯襖袄襝裣襠裆襤褴襪袜襬摆襯衬襲袭襴襕覈核見见覎觃規规覓觅視视覘觇覡觋覥觍覦觎親亲覬觊覯觏覲觐覷觑覺觉覽览覿觌觀观觴觞觶觯觸触訁讠訂订訃讣計计訊讯訌讧討讨訐讦訒讱訓训訕讪訖讫託托記记訛讹訝讶訟讼訢䜣訣诀訥讷訩讻訪访設设許许訴诉訶诃診诊註注証证詁诂詆诋詎讵詐诈詒诒詔诏評评詖诐詗诇詘诎詛诅詞词詠咏詡诩詢询詣诣試试詩诗詫诧詬诟詭诡詮诠詰诘話话該该詳详詵诜詼诙詿诖誄诔誅诛誆诓誇夸誌志認认誑诳誒诶誕诞誘诱誚诮語语誠诚誡诫誣诬誤误誥诰誦诵誨诲說说説说誰谁課课誶谇誹诽誼谊誾訚調调諂谄諄谆談谈諉诿請请諍诤諏诹諑诼諒谅論论諗谂諛谀諜谍諝谞諞谝諡谥諢诨諤谔諦谛諧谐諫谏諭谕諮咨諱讳諳谙諶谌諷讽諸诸諺谚諼谖諾诺謀谋謁谒謂谓謄誊謅诌謊谎謎谜謐谧謔谑謖谡謗谤謙谦謚谥講讲謝谢謠谣謡谣謨谟謫谪謬谬謭谫謳讴謹谨謾谩譁哗證证譎谲譏讥譖谮識识譙谯譚谭譜谱譟噪譫谵譭毁譯译議议譴谴護护譸诪譽誉譾谫讀读讅谉變变讋詟讌䜩讎雠讒谗讓让讕谰讖谶讚赞讜谠讞谳谿溪豈岂豎竖豐丰豔艳豬猪豶豮貍狸貓猫貙䝙貝贝貞贞貟贠負负財财貢贡貧贫貨货販贩貪贪貫贯責责貯贮貰贳貲赀貳贰貴贵貶贬買买貸贷貺贶費费貼贴貽贻貿贸賀贺賁贲賂赂賃赁賄贿賅赅資资賈贾賊贼賑赈賒赊賓宾賕赇賙赒賚赉賜赐賞赏賠赔賡赓賢贤賣卖賤贱賦赋賧赕質质賫赍賬账賭赌賰䞐賴赖賵赗賺赚賻赙購购賽赛賾赜贄贽贅赘贇赟贈赠贊赞贋赝贍赡贏赢贐赆贓赃贔赑贖赎贗赝贛赣贜赃赬赪趕赶趙赵趨趋趲趱跡迹踐践踰逾踴踊蹌跄蹕跸蹟迹蹠跖蹣蹒蹤踪蹺跷躂跶躉趸躊踌躋跻躍跃躎䟢躑踯躒跞躓踬躕蹰躚跹躡蹑躥蹿躦躜躪躏軀躯車车軋轧軌轨軍军軑轪軒轩軔轫軛轭軟软軤轷軫轸軲轱軸轴軹轵軺轺軻轲軼轶軾轼較较輅辂輇辁輈辀載载輊轾輒辄輓挽輔辅輕轻輛辆輜辎輝辉輞辋輟辍輥辊輦辇輩辈輪轮輬辌輯辑輳辏輸输輻辐輼辒輾辗輿舆轀辒轂毂轄辖轅辕轆辘轉转轍辙轎轿轔辚轟轰轡辔轢轹轤轳辦办辭辞辮辫辯辩農农迴回逕径這这連连週周進进遊游運运過过達达違违遙遥遜逊遞递遠远遡溯適适遲迟遶绕遷迁選选遺遗遼辽邁迈還还邇迩邊边邏逻邐逦郟郏郵邮鄆郓鄉乡鄒邹鄔邬鄖郧鄧邓鄭郑鄰邻鄲郸鄴邺鄶郐鄺邝酇酂酈郦醃腌醖酝醜丑醞酝醟蒏醣糖醫医醬酱醱酦釀酿釁衅釃酾釅酽釋释釐厘釒钅釓钆釔钇釕钌釗钊釘钉釙钋針针釣钓釤钐釦扣釧钏釩钒釵钗釷钍釹钕釺钎釾䥺鈀钯鈁钫鈃钘鈄钭鈅钥鈈钚鈉钠鈍钝鈎钩鈐钤鈑钣鈒钑鈔钞鈕钮鈞钧鈡钟鈣钙鈥钬鈦钛鈧钪鈮铌鈰铈鈳钶鈴铃鈷钴鈸钹鈹铍鈺钰鈽钸鈾铀鈿钿鉀钾鉅巨鉆钻鉈铊鉉铉鉋铇鉍铋鉑铂鉕钷鉗钳鉚铆鉛铅鉞钺鉢钵鉤钩鉦钲鉬钼鉭钽鉳锫鉶铏鉸铰鉺铒鉻铬鉿铪銀银銃铳銅铜銍铚銑铣銓铨銖铢銘铭銚铫銛铦銜衔銠铑銣铷銥铱銦铟銨铵銩铥銪铕銫铯銬铐銱铞銳锐銷销銹锈銻锑銼锉鋁铝鋃锒鋅锌鋇钡鋌铤鋏铗鋒锋鋙铻鋝锊鋟锓鋣铘鋤锄鋥锃鋦锔鋨锇鋩铓鋪铺鋭锐鋮铖鋯锆鋰锂鋱铽鋶锍鋸锯鋼钢錁锞錄录錆锖錇锫錈锩錏铔錐锥錒锕錕锟錘锤錙锱錚铮錛锛錟锬錠锭錡锜錢钱錦锦錨锚錩锠錫锡錮锢錯错録录錳锰錶表錸铼錼镎鍀锝鍁锨鍃锪鍅钫鍆钔鍇锴鍈锳鍊炼鍋锅鍍镀鍔锷鍘铡鍚钖鍛锻鍠锽鍤锸鍥锲鍩锘鍬锹鍰锾鍵键鍶锶鍺锗鍼针鍾钟鎂镁鎄锿鎇镅鎊镑鎌镰鎔镕鎖锁鎘镉鎚锤鎛镈鎡镃鎢钨鎣蓥鎦镏鎧铠鎩铩鎪锼鎬镐鎭镇鎮镇鎰镒鎲镋鎳镍鎵镓鎶鿔鎸镌鎿镎鏃镞鏇旋鏈链鏌镆鏍镙鏐镠鏑镝鏗铿鏘锵鏜镗鏝镘鏞镛鏟铲鏡镜鏢镖鏤镂鏨錾鏰镚鏵铧鏷镤鏹镪鏺䥽鏽锈鐃铙鐋铴鐐镣鐒铹鐓镦鐔镡鐘钟鐙镫鐝镢鐠镨鐥䦅鐦锎鐧锏鐨镄鐫镌鐮镰鐯䦃鐲镯鐳镭鐵铁鐶镮鐸铎鐺铛鐿镱鑄铸鑊镬鑌镔鑑鉴鑒鉴鑔镲鑕锧鑞镴鑠铄鑣镳鑥镥鑭镧鑰钥鑱镵鑲镶鑷镊鑹镩鑼锣鑽钻鑾銮鑿凿钁镢钂镋長长門门閂闩閃闪閆闫閈闬閉闭開开閌闶閎闳閏闰閑闲閒闲間间閔闵閘闸閡阂閣阁閤合閥阀閨闺閩闽閫阃閬阆閭闾閱阅閲阅閶阊閹阉閻阎閼阏閽阍閾阈閿阌闃阒闆板闇暗闈闱闊阔闋阕闌阑闍阇闐阗闒阘闓闿闔阖闕阙闖闯關关闞阚闠阓闡阐闢辟闤阛闥闼陘陉陝陕陞升陣阵陰阴陳陈陸陆陽阳隉陧隊队階阶隕陨際际隨随險险隯陦隱隐隴陇隸隶隻只雋隽雖虽雙双雛雏雜杂雞鸡離离難难雲云電电霑沾霢霡霧雾霽霁靂雳靄霭靆叇靈灵靉叆靚靓靜静靝靔靦腼靨靥鞏巩鞝绱鞦秋鞽鞒韁缰韃鞑韆千韉鞯韋韦韌韧韍韨韓韩韙韪韜韬韝鞲韞韫韻韵響响頁页頂顶頃顷項项順顺頇顸須须頊顼頌颂頎颀頏颃預预頑顽頒颁頓顿頗颇領领頜颌頡颉頤颐頦颏頭头頮颒頰颊頲颋頴颕頷颔頸颈頹颓頻频頽颓顆颗題题額额顎颚顏颜顒颙顓颛顔颜願愿顙颡顛颠類类顢颟顥颢顧顾顫颤顬颥顯显顰颦顱颅顳颞顴颧風风颭飐颮飑颯飒颱台颳刮颶飓颸飔颺飏颻飖颼飕飀飗飄飘飆飙飈飚飛飞飠饣飢饥飣饤飥饦飩饨飪饪飫饫飭饬飯饭飱飧飲饮飴饴飼饲飽饱飾饰飿饳餃饺餄饸餅饼餈糍餉饷養养餌饵餎饹餏饻餑饽餒馁餓饿餕馂餖饾餘余餚肴餛馄餜馃餞饯餡馅館馆餬糊餱糇餳饧餵喂餶馉餷馇餺馎餼饩餾馏餿馊饁馌饃馍饅馒饈馐饉馑饊馓饋馈饌馔饑饥饒饶饗飨饜餍饞馋饢馕馬马馭驭馮冯馱驮馳驰馴驯馹驲駁驳駐驻駑驽駒驹駔驵駕驾駘骀駙驸駛驶駝驼駟驷駡骂駢骈駭骇駰骃駱骆駸骎駿骏騁骋騂骍騅骓騌骔騍骒騎骑騏骐騖骛騙骗騤骙騧䯄騫骞騭骘騮骝騰腾騶驺騷骚騸骟騾骡驀蓦驁骜驂骖驃骠驄骢驅驱驊骅驌骕驍骁驏骣驕骄驗验驚惊驛驿驟骤驢驴驤骧驥骥驦骦驪骊驫骉骯肮髏髅髒脏體体髕髌髖髋髮发鬆松鬍胡鬚须鬢鬓鬥斗鬧闹鬨哄鬩阋鬮阄鬱郁鬹鬶魎魉魘魇魚鱼魛鱽魢鱾魨鲀魯鲁魴鲂魷鱿魺鲄鮁鲅鮃鲆鮊鲌鮋鲉鮍鲏鮎鲇鮐鲐鮑鲍鮒鲋鮓鲊鮚鲒鮜鲘鮝鲞鮞鲕鮣䲟鮦鲖鮪鲔鮫鲛鮭鲑鮮鲜鮳鲓鮶鲪鮺鲝鯀鲧鯁鲠鯇鲩鯉鲤鯊鲨鯒鲬鯔鲻鯕鲯鯖鲭鯗鲞鯛鲷鯝鲴鯡鲱鯢鲵鯤鲲鯧鲳鯨鲸鯪鲮鯫鲰鯰鲶鯴鲺鯷鳀鯽鲫鯿鳊鰁鳈鰂鲗鰃鳂鰆䲠鰈鲽鰉鳇鰌䲡鰍鳅鰏鲾鰐鳄鰒鳆鰓鳃鰛鳁鰜鳒鰟鳑鰠鳋鰣鲥鰥鳏鰧䲢鰨鳎鰩鳐鰭鳍鰮鳁鰱鲢鰲鳌鰳鳓鰵鳘鰷鲦鰹鲣鰺鲹鰻鳗鰼鳛鰾鳔鱂鳉鱅鳙鱈鳕鱉鳖鱒鳟鱔鳝鱖鳜鱗鳞鱘鲟鱝鲼鱟鲎鱠鲙鱣鳣鱤鳡鱧鳢鱨鲿鱭鲚鱯鳠鱷鳄鱸鲈鱺鲡鳥鸟鳧凫鳩鸠鳬凫鳲鸤鳳凤鳴鸣鳶鸢鳾䴓鴆鸩鴇鸨鴉鸦鴒鸰鴕鸵鴛鸳鴝鸲鴞鸮鴟鸱鴣鸪鴦鸯鴨鸭鴯鸸鴰鸹鴴鸻鴷䴕鴻鸿鴿鸽鵁䴔鵂鸺鵃鸼鵐鹀鵑鹃鵒鹆鵓鹁鵜鹈鵝鹅鵠鹄鵡鹉鵪鹌鵬鹏鵮鹐鵯鹎鵰雕鵲鹊鵷鹓鵾鹍鶄䴖鶇鸫鶉鹑鶊鹒鶓鹋鶖鹙鶘鹕鶚鹗鶡鹖鶥鹛鶩鹜鶪䴗鶬鸧鶯莺鶲鹟鶴鹤鶹鹠鶺鹡鶻鹘鶼鹣鶿鹚鷀鹚鷁鹢鷂鹞鷄鸡鷉䴘鷊鹝鷓鹧鷖鹥鷗鸥鷙鸷鷚鹨鷥鸶鷦鹪鷫鹔鷯鹩鷲鹫鷳鹇鷴鹇鷸鹬鷹鹰鷺鹭鷽鸴鸂㶉鸇鹯鸊䴙鸌鹱鸏鹲鸕鸬鸘鹴鸚鹦鸛鹳鸝鹂鸞鸾鹵卤鹹咸鹺鹾鹼碱鹽盐麗丽麥麦麩麸麪面麫面麯曲麴曲麵面麼么麽么黃黄黌黉點点黨党黲黪黴霉黶黡黷黩黽黾黿鼋鼂鼌鼉鼍鼕冬鼴鼹齊齐齋斋齎赍齏齑齒齿齔龀齕龁齗龂齙龅齜龇齟龃齠龆齡龄齣出齦龈齧啮齪龊齬龉齲龋齶腭齷龌龍龙龎厐龐庞龑䶮龔龚龕龛龜龟鿁䜤鿓鿒");
    const m = {};
    for (let i = 0; i + 1 < p.length; i += 2) if (!m[p[i]]) m[p[i]] = p[i + 1];
    return m;
  })();
  /* TW→CN vocabulary overrides (phrase-level; char map can't localize these) */
  /* TW→CN vocabulary. The char map converts glyphs but cannot fix word choice:
     飯店 char-converts to 饭店, which means *restaurant* in Mainland usage, and
     行動 to 行动 (*action*) rather than 移动 (*mobile*). Longest keys must be
     listed before any prefix of themselves. */
  const T2S_PHRASE = {
    '行動電源': '移动电源', '磁吸行動電源': '磁吸移动电源',
    '解析度': '分辨率', '壓克力': '亚克力', '三腳架': '三脚架',
    '螢幕': '屏幕', '影片': '视频', '回覆': '回复', '保固': '保修',
    '支援': '支持', '相容': '兼容', '視訊': '视频', '急煞': '急刹',
    '內建': '内置', '飯店': '酒店', '行動': '移动', '紀錄': '记录',
    '記錄': '记录', '腳架': '三脚架', '資訊': '信息', '軟體': '软件',
    '硬體': '硬件', '品項': '品类', '藍牙': '蓝牙', '鋼化': '钢化',
    '鏡頭': '镜头', '傳輸': '传输', '隨身碟': 'U盘', '網路': '网络',
    '滑鼠': '鼠标', '鍵盤': '键盘', '列印': '打印', '預設': '默认',
  };
  const toSimp = (s) => {
    if (s == null) return s;
    s = String(s);
    for (const k in T2S_PHRASE) s = s.split(k).join(T2S_PHRASE[k]);
    return s.replace(/[一-鿿]/g, (c) => T2S[c] || c);
  };

  /* ---------- i18n ---------- */
  /* First visit: detect from browser languages → supported code; else fall back to English.
     Only an explicit menu pick is persisted (setLang), so detection re-runs until the user chooses. */
  function detectLang() {
    const cands = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    for (const raw of cands) {
      const l = (raw || '').toLowerCase();
      if (l.startsWith('vi')) return 'vi';
      if (l.startsWith('id') || l.startsWith('in')) return 'id';   // 'in' = legacy Indonesian code
      if (l.startsWith('zh')) return /hant|-tw|-hk|-mo/.test(l) ? 'zh' : 'zh-Hans'; // TW/HK/MO → Traditional; else Simplified
      if (l.startsWith('en')) return 'en';
    }
    return 'en';
  }
  let lang = localStorage.getItem('viemag-lang');
  if (!SUPPORTED.includes(lang)) lang = detectLang();
  /* Warranty terms are interpolated, not hard-coded into five languages. Before
     2026-07-29 every string said "12 months / 14 days" literally, so the
     warranty_months and defect_exchange_days columns in /admin were inert and,
     worse, a policy change would have left the site stating the old terms.
     Defaults come from DB.config; the product page passes the SKU's own values. */
  const termVars = () => ({
    m: (window.DB && DB.config && DB.config.warrantyMonths) || 12,
    d: (window.DB && DB.config && DB.config.exchangeDays) || 14,
  });
  const interp = (str, vars) => {
    if (str.indexOf('{') === -1) return str;
    const v = vars ? Object.assign(termVars(), vars) : termVars();
    return str.replace(/\{(\w+)\}/g, (m0, k) => (v[k] !== undefined ? String(v[k]) : m0));
  };

  const tRaw = (key) => {
    if (lang === 'zh-Hans') {
      const ov = DICT['zh-Hans'];
      if (ov && ov[key] != null) return ov[key];       // hand-tuned seed/override wins verbatim
      const zh = DICT.zh || {};
      if (zh[key] != null) return toSimp(zh[key]);      // new/untuned key → auto-convert from zh
      return (DICT.en && DICT.en[key]) || key;
    }
    return (DICT[lang] && DICT[lang][key]) || (DICT.en && DICT.en[key]) || key;
  };
  const t = (key, vars) => interp(tRaw(key), vars);
  /* Translatable field → the active language's value, falling back to English.
     Values are usually strings; `accessories` is a LIST, which forces two extra
     rules. Both are traps rather than preferences:

     1. An empty array must count as missing. `[] || fallback` returns [],
        because an empty array is truthy — so a list left untranslated would
        render as nothing while a filled English one sat right there, the exact
        opposite of how every string field behaves.
     2. toSimp() coerces with String(). Handing it an array returns one
        comma-joined string, which then breaks every caller expecting a list —
        and only in Simplified Chinese, which is not the default, so it would
        ship unnoticed. Convert item by item instead.

     String behaviour is deliberately left byte-for-byte as it was. */
  const gone = (v) => Array.isArray(v) && !v.length;
  const tf = (obj) => {
    if (!obj) return '';
    if (lang === 'zh-Hans') {
      // hand-tuned seed/override wins verbatim
      if (obj['zh-Hans'] != null && !gone(obj['zh-Hans'])) return obj['zh-Hans'];
      const src = (gone(obj.zh) ? null : obj.zh) || obj.en || ''; // no override → auto-convert
      return Array.isArray(src) ? src.map(toSimp) : toSimp(src);
    }
    return (gone(obj[lang]) ? null : obj[lang]) || obj.en || '';
  };
  window.VIEMAG = { t, tf, get lang() { return lang; } };

  function setLang(next) {
    if (!SUPPORTED.includes(next)) return;
    localStorage.setItem('viemag-lang', next);
    location.reload();
  }

  /* ---------- icons (hand-drawn, lucide-style strokes) ---------- */
  const IC = {
    car: '<path d="M4 15l1.5-5.5A2 2 0 017.4 8h9.2a2 2 0 011.9 1.5L20 15M4 15h16M4 15v3.5a.5.5 0 00.5.5H6a1 1 0 001-1v-1h10v1a1 1 0 001 1h1.5a.5.5 0 00.5-.5V15M7.5 12h.01M16.5 12h.01"/>',
    desk: '<path d="M3 9h18M3 9v10M21 9v10M6 9V5.5A1.5 1.5 0 017.5 4h9A1.5 1.5 0 0118 5.5V9M8 19v-4h8v4"/>',
    plane: '<path d="M10.5 13.5L3 11l1.5-1.5L10 10l4-5.5L16 3l.5 2-2.5 5.5 3.5 1L19 10l2 1-8 3.5L11 21l-1.5-1 1-6.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    home: '<path d="M3 11l9-7 9 7M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    swap: '<path d="M4 8h13M14 4.5L17.5 8 14 11.5M20 16H7M10 12.5L6.5 16l3.5 3.5"/>',
    chat: '<path d="M21 12a8 8 0 01-8 8H4l2.4-2.9A8 8 0 1121 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    guide: '<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15z"/><path d="M4 20.5A2.5 2.5 0 016.5 18H20M9 8h6"/>',
    magnet: '<path d="M6 4v7a6 6 0 0012 0V4M6 4h4v4H6zM14 4h4v4h-4z"/><path d="M10 21a9.5 9.5 0 01-4-3M14 21a9.5 9.5 0 004-3" stroke-dasharray="1.5 2.5"/>',
    thermo: '<path d="M10 4a2 2 0 014 0v9.5a4 4 0 11-4 0V4z"/><circle cx="12" cy="17" r="1.6"/>',
    wave: '<path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><path d="M2 17c2-4 4-4 6 0s4 4 6 0 4-4 6 0" opacity=".45"/>',
    cycle: '<path d="M20 12a8 8 0 11-2.3-5.6M20 3v4h-4"/>',
    bolt: '<path d="M13 2L5 13h5l-1 9 8-11h-5l1-9z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    chevron: '<path d="M8 10l4 4 4-4"/>',
    box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5"/><path d="M16 5.5a3.5 3.5 0 010 6M18.5 20c-.2-2.3-1.2-4-2.8-4.9"/>',
    external: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v4.5A1.5 1.5 0 0116.5 20h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10"/>'
  };
  const icon = (name, cls) =>
    `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name] || ''}</svg>`;
  window.VIEMAG.icon = icon;

  /* ---------- product art (placeholder illustrations) ---------- */
  const C = { navy: '#1A3A5C', mid: '#0F1F33', copper: '#C8941A', teal: '#2FA7A0', ivory: '#F8F5EF', line: '#D9D2C5' };
  const phone = (x, y, w, h, r) => `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${C.mid}"/>
    <rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="${r - 2}" fill="#fff"/>
    <circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w * 0.26}" fill="none" stroke="${C.line}" stroke-width="2" stroke-dasharray="4 4"/>`;
  const bolt = (x, y, s) => `<path transform="translate(${x},${y}) scale(${s})" d="M6 0L0 8h3.6L2.8 15 9 6.6H5.2L6 0z" fill="${C.copper}"/>`;
  const ART = {
    vent: `<g><rect x="30" y="26" width="80" height="10" rx="5" fill="${C.ivory}" stroke="${C.line}"/><rect x="30" y="42" width="80" height="10" rx="5" fill="${C.ivory}" stroke="${C.line}"/><rect x="60" y="30" width="20" height="26" rx="6" fill="${C.navy}"/>${phone(46, 52, 48, 84, 10)}</g>`,
    dash: `<g><path d="M20 118q50-26 100 0v14H20z" fill="${C.ivory}" stroke="${C.line}"/><rect x="62" y="92" width="16" height="26" rx="5" fill="${C.navy}"/><circle cx="70" cy="92" r="12" fill="${C.navy}"/>${phone(46, 22, 48, 84, 10)}</g>`,
    suction: `<g><rect x="18" y="112" width="42" height="8" rx="4" fill="${C.ivory}" stroke="${C.line}"/><circle cx="39" cy="106" r="12" fill="${C.navy}"/><path d="M39 94q10-32 34-38" fill="none" stroke="${C.navy}" stroke-width="8" stroke-linecap="round"/><circle cx="76" cy="54" r="9" fill="${C.copper}"/>${phone(66, 16, 44, 78, 9)}</g>`,
    clip: `<g><rect x="20" y="20" width="64" height="44" rx="6" fill="${C.mid}"/><rect x="24" y="24" width="56" height="36" rx="4" fill="${C.teal}" opacity=".25"/><path d="M84 40h14" stroke="${C.navy}" stroke-width="7" stroke-linecap="round"/><circle cx="100" cy="40" r="8" fill="${C.navy}"/>${phone(84, 48, 42, 74, 9)}</g>`,
    tape: `<g><rect x="22" y="104" width="96 " height="10" rx="4" fill="${C.ivory}" stroke="${C.line}"/><rect x="52" y="84" width="36" height="20" rx="5" fill="${C.navy}"/><rect x="58" y="96" width="24" height="5" rx="2.5" fill="${C.copper}"/>${phone(46, 8, 48, 82, 10)}</g>`,
    pro: `<g><circle cx="70" cy="72" r="46" fill="none" stroke="${C.copper}" stroke-width="2.5" stroke-dasharray="6 6"/><circle cx="70" cy="72" r="34" fill="${C.navy}"/><circle cx="70" cy="72" r="24" fill="${C.ivory}"/><circle cx="70" cy="72" r="24" fill="none" stroke="${C.copper}" stroke-width="3"/><path d="M70 56a16 16 0 010 32" fill="none" stroke="${C.navy}" stroke-width="4" stroke-linecap="round"/></g>`,
    carcharge: `<g><rect x="30" y="26" width="80" height="10" rx="5" fill="${C.ivory}" stroke="${C.line}"/><rect x="60" y="30" width="20" height="22" rx="6" fill="${C.navy}"/>${phone(46, 48, 48, 84, 10)}${bolt(62, 74, 2.4)}</g>`,
    dashcharge: `<g><path d="M20 118q50-26 100 0v14H20z" fill="${C.ivory}" stroke="${C.line}"/><rect x="62" y="92" width="16" height="26" rx="5" fill="${C.navy}"/>${phone(46, 20, 48, 84, 10)}${bolt(62, 46, 2.4)}</g>`,
    fancharge: `<g>${phone(24, 26, 48, 86, 10)}<circle cx="94" cy="70" r="28" fill="${C.navy}"/><g stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M94 70l0-16M94 70l14 8M94 70l-14 8"/></g><circle cx="94" cy="70" r="5" fill="${C.copper}"/><path d="M120 46q8 8 0 16M126 40q12 12 0 24" stroke="${C.teal}" stroke-width="2.5" fill="none" stroke-linecap="round"/>${bolt(40, 56, 2.2)}</g>`,
    suctioncharge: `<g><rect x="16" y="114" width="40" height="8" rx="4" fill="${C.ivory}" stroke="${C.line}"/><circle cx="36" cy="108" r="11" fill="${C.navy}"/><path d="M36 97q4-40 34-46" fill="none" stroke="${C.navy}" stroke-width="8" stroke-linecap="round"/>${phone(62, 14, 46, 80, 9)}${bolt(78, 42, 2.2)}</g>`,
    deskcharge: `<g><rect x="26" y="112" width="88" height="8" rx="4" fill="${C.ivory}" stroke="${C.line}"/><ellipse cx="70" cy="106" rx="34" ry="9" fill="${C.navy}"/>${phone(46, 20, 48, 82, 10)}${bolt(62, 48, 2.4)}</g>`,
    stand2in1: `<g><rect x="20" y="112" width="100" height="8" rx="4" fill="${C.ivory}" stroke="${C.line}"/><path d="M52 112l8-30" stroke="${C.navy}" stroke-width="8" stroke-linecap="round"/>${phone(42, 12, 44, 74, 9)}<rect x="88" y="94" width="30" height="18" rx="8" fill="${C.navy}"/><circle cx="98" cy="103" r="4" fill="#fff"/><circle cx="108" cy="103" r="4" fill="#fff"/>${bolt(58, 38, 2)}</g>`,
    fold: `<g><path d="M28 112L58 70h44l-6 42z" fill="${C.ivory}" stroke="${C.line}"/><rect x="52" y="30" width="46" height="46" rx="8" fill="${C.navy}"/><circle cx="75" cy="53" r="14" fill="none" stroke="${C.copper}" stroke-width="3"/>${bolt(70, 44, 1.8)}</g>`,
    ring: `<g><circle cx="70" cy="70" r="40" fill="none" stroke="${C.navy}" stroke-width="12"/><circle cx="70" cy="70" r="40" fill="none" stroke="${C.copper}" stroke-width="3" stroke-dasharray="8 10"/><rect x="62" y="24" width="16" height="6" rx="3" fill="${C.copper}"/></g>`,
    case: `<g>${phone(36, 18, 56, 100, 12)}<circle cx="64" cy="68" r="20" fill="none" stroke="${C.copper}" stroke-width="4"/><rect x="98" y="34" width="18" height="34" rx="6" fill="${C.navy}"/><circle cx="107" cy="44" r="4.5" fill="${C.ivory}"/></g>`,
    powerbank: `<g><rect x="30" y="34" width="52" height="88" rx="10" fill="${C.mid}"/><rect x="34" y="38" width="44" height="80" rx="7" fill="#fff"/><rect x="58" y="26" width="52" height="88" rx="10" fill="${C.navy}"/><circle cx="84" cy="70" r="18" fill="none" stroke="${C.copper}" stroke-width="3.5"/>${bolt(78, 58, 2.2)}</g>`,
    stand: `<g><rect x="24" y="112" width="92" height="8" rx="4" fill="${C.ivory}" stroke="${C.line}"/><path d="M70 112V84" stroke="${C.navy}" stroke-width="9" stroke-linecap="round"/><circle cx="70" cy="80" r="10" fill="${C.copper}"/>${phone(46, 10, 48, 72, 9)}</g>`,
    tripod: `<g><path d="M70 74L44 118M70 74l26 44M70 74v44" stroke="${C.navy}" stroke-width="7" stroke-linecap="round"/><circle cx="70" cy="66" r="11" fill="${C.copper}"/>${phone(48, 6, 44, 60, 8)}</g>`,
    /* Added 2026-08-16 for the R (Ride) ecosystem — handlebar with grips and a
       mount clamped to the middle. The other keys all pre-date the V3 scheme;
       this is the first ecosystem that arrived without artwork already drawn. */
    ride: `<g><path d="M18 108q22-16 52-16t52 16" fill="none" stroke="${C.navy}" stroke-width="8" stroke-linecap="round"/><rect x="14" y="100" width="22" height="12" rx="6" fill="${C.mid}"/><rect x="104" y="100" width="22" height="12" rx="6" fill="${C.mid}"/><path d="M70 92V78" stroke="${C.navy}" stroke-width="9" stroke-linecap="round"/><circle cx="70" cy="74" r="10" fill="${C.copper}"/>${phone(48, 12, 44, 58, 8)}</g>`
  };
  const art = (key, label) =>
    `<svg viewBox="0 0 140 140" role="img" aria-label="${label || ''}">${ART[key] || ART.ring}</svg>`;
  window.VIEMAG.art = art;

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* Multi-line copy → the lines the author actually typed.
     `claim` and `accessories` are textareas in /admin where staff write one
     selling point (or one boxed item) per line. HTML collapses newlines, so
     rendering the raw value inside a <p> turned five selling points into one
     run-on sentence — the shape the author saw in the textarea was lost between
     the backend and the page.
     A leading bullet character is stripped because the markup supplies its own
     marker: a line typed as "• Magnetic ring x1" would otherwise show two
     bullets on one row. Only a bullet FOLLOWED BY WHITESPACE counts, so a dash
     used inside a sentence ("360° rotation — switch orientation") and a value
     like "-40°C" are both left alone. */
  const BULLET = /^\s*(?:[•·▪‣∙◦]|[-–—*])\s+/;
  const lines = (v) => String(v == null ? '' : v)
    .split(/\r?\n/)
    .map((s) => s.replace(BULLET, '').trim())
    .filter(Boolean);
  /* One line stays a <p>: most SKUs have a single claim, and their markup and
     spacing are unchanged by this. Two or more become a list.
     `max` caps the card teaser so a six-line claim cannot stretch one grid cell
     past its neighbours; the product page passes no cap and shows every line. */
  const claimHtml = (v, max) => {
    const ls = lines(v);
    if (!ls.length) return '';
    if (ls.length === 1) return `<p class="claim">${esc(ls[0])}</p>`;
    const shown = max ? ls.slice(0, max) : ls;
    return `<ul class="claim claim-list">${shown.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  };
  const stars = (r) => { const f = Math.round(r); return '★★★★★'.slice(0, f) + '☆☆☆☆☆'.slice(0, 5 - f); };
  const money = (v) => v == null ? '' : `<small>US$</small>${v.toFixed(2).replace(/\.00$/, '')}`;
  const catById = (id) => DB.categories.find((c) => c.id === id);
  const prodBySku = (sku) => DB.products.find((p) => p.sku === sku);
  /* Products that can actually be bought. Discontinued ones are excluded on
     purpose: they still have pages, but recommending them or counting them as
     available would send someone to a dead end. */
  const published = DB.products.filter((p) => p.status === 'published');

  /* ---------- shared header / footer ---------- */
  const logoSvg = `<svg class="ring" viewBox="0 0 26 26" aria-hidden="true">
    <circle cx="13" cy="13" r="9.5" fill="none" stroke="${C.navy}" stroke-width="4"/>
    <path d="M13 3.5a9.5 9.5 0 019.5 9.5" fill="none" stroke="${C.copper}" stroke-width="4" stroke-linecap="round"/></svg>`;

  /* The approved wordmark, outlined from VIEMAG_logo.ai (2026-08-18). Kept inline
     rather than <img src="assets/viemag-wordmark.svg"> for one reason: an <img>
     cannot inherit currentColor, and the footer needs the mark reversed to white
     on the dark background. Inline, one CSS colour drives both placements.
     assets/viemag-wordmark.svg holds the same paths for use outside the site —
     change one and change the other. */
  const wordmarkSvg = `<svg class="wordmark" viewBox="0 0 511.945 82.888" role="img" aria-label="VIEMAG"><path transform="matrix(1,0,0,-1,48.978,63.152006)" d="M0 0-30.141 63.152H-48.978L-9.419-19.735H9.419L48.978 63.152H30.141Z" fill="currentColor"/><path transform="matrix(1,0,0,-1,-37.676099,113.016307)" d="M143.168 30.129H162.006V113.015H143.168Z" fill="currentColor"/><path transform="matrix(1,0,0,-1,207.311,15.070602)" d="M0 0 3.672 15.07H-67.911V-67.816H3.672V-52.746H-49.074V-33.908H-11.303L-7.63-18.838H-49.074V0Z" fill="currentColor"/><path transform="matrix(1,0,0,-1,320.24284,.00030517579)" d="M0 0H-18.838L-48.978-45.928-79.119 0H-97.957V-82.887H-79.119V-28.705L-48.978-74.635-18.838-28.705V-82.887H0V0Z" fill="currentColor"/><path transform="matrix(1,0,0,-1,361.0003,52.747705)" d="M0 0 15.756 33.013 31.512 0ZM6.337 52.747-33.222-30.139H-14.385L-7.193-15.07H38.705L45.897-30.139H64.734L25.175 52.747Z" fill="currentColor"/><path transform="matrix(1,0,0,-1,470.5024,48.978906)" d="M0 0H22.605V-18.838H-3.748-3.787C-24.295-18.823-39.326 4.598-23.606 26.158-19.977 31.135-14.039 33.907-7.88 33.907H38.214L41.443 48.978H-7.535C-20.404 48.978-31.903 43.111-39.505 33.907-45.422 26.742-48.978 17.554-48.978 7.535-48.978-2.484-45.423-11.672-39.505-18.838-31.908-28.037-20.417-33.902-7.555-33.908H-7.516 .424C.43-33.908 .437-33.909 .443-33.909 .45-33.909 .456-33.908 .462-33.908H41.443V15.071H3.768Z" fill="currentColor"/></svg>`;

  function header(active) {
    const nav = [
      ['products', 'products.html', 'nav.products'],
      ['scenarios', 'scenarios.html', 'nav.scenarios'],
      ['why', 'why-viemag.html', 'nav.why'],
      ['insights', 'insights.html', 'nav.insights'],
      ['support', 'support.html', 'nav.support'],
      ['dealers', 'dealers.html', 'nav.dealers'],
      ['about', 'about.html', 'nav.about']
    ].map(([id, href, key]) =>
      `<a href="${href}" class="${active === id ? 'active' : ''}" ${active === id ? 'aria-current="page"' : ''}>${t(key)}</a>`).join('');
    const langBtns = LANGS.map((l) =>
      `<button data-lang="${l.code}" class="${l.code === lang ? 'active' : ''}">${l.label}</button>`).join('');
    return `
    <header class="site-header">
      <div class="container header-inner">
        <a class="logo" href="index.html" aria-label="VIEMAG home">${logoSvg}${wordmarkSvg}</a>
        <nav class="main-nav" id="mainNav" aria-label="Main">${nav}</nav>
        <div class="header-actions">
          <div class="lang-switch">
            <button class="lang-btn" id="langBtn" aria-haspopup="true" aria-expanded="false">${icon('globe')}${(LANGS.find((l) => l.code === lang) || {}).short || lang.toUpperCase()}${icon('chevron')}</button>
            <div class="lang-menu" id="langMenu" role="menu">${langBtns}</div>
          </div>
          <a class="btn btn-primary btn-sm header-cta" href="${DB.config.shopeeUrl}" target="_blank" rel="noopener">${t('cta.shopee')}</a>
          <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">${icon('menu')}</button>
        </div>
      </div>
    </header>`;
  }

  function footer() {
    return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-top">
          <div class="footer-brand">
            <a class="logo" href="index.html">${logoSvg.replace(C.navy, '#F8F5EF')}${wordmarkSvg}</a>
            <p>${t('footer.desc')}</p>
            <div class="tagline">VIEMAG — Value . Innovation . Excellence.</div>
          </div>
          <div>
            <h4>${t('footer.products')}</h4>
            <ul>${DB.categories.filter((c) => c.status === 'published').map((c) =>
              `<li><a href="products.html?cat=${c.id}">${esc(tf(c.name))}</a></li>`).join('')}</ul>
          </div>
          <div>
            <h4>${t('footer.support')}</h4>
            <ul>
              <li><a href="support.html">${t('footer.warranty')}</a></li>
              <li><a href="support.html#faq">${t('footer.faq')}</a></li>
              <li><a href="why-viemag.html">${t('nav.why')}</a></li>
            </ul>
          </div>
          <div>
            <h4>${t('footer.company')}</h4>
            <ul>
              <li><a href="about.html">${t('footer.about')}</a></li>
              <li><a href="dealers.html">${t('footer.dealer')}</a></li>
              <li><a href="scenarios.html">${t('nav.scenarios')}</a></li>
              <li><a href="insights.html">${t('nav.insights')}</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-trust">
          <span>${icon('shield')}${t('footer.trust1')}</span>
          <span>${icon('swap')}${t('footer.trust2')}</span>
          <span>${icon('chat')}${t('footer.trust3')}</span>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ${t('footer.rights')}</span>
          <span style="max-width:560px">${t('footer.legal')}</span>
        </div>
      </div>
    </footer>`;
  }

  /* ---------- renderers ---------- */
  function qiChip(p) {
    if (p.qi === 'none' || !p.qi) return '';
    return `<span class="chip qi">${t('qi.' + p.qi)}</span>`;
  }
  /* real photo (Notion Hero Image → assets/products/…) if present, else SVG art */
  const thumb = (p) => p.img
    ? `<img class="thumb-img" src="${p.img}" alt="${esc(tf(p.name))}" loading="lazy" style="width:100%;height:100%;object-fit:contain">`
    : art(p.art, tf(p.name));

  function productCard(p) {
    const cat = catById(p.category);
    const future = p.status === 'future';
    const badge = p.badge ? `<span class="badge ${p.badge}">${p.badge === 'soon' ? t('cats.soon') : p.badge === 'new' ? t('badge.new') : t('badge.popular')}</span>` : '';
    const ratingHtml = p.rating
      ? `<div class="rating"><span class="stars" aria-hidden="true">${stars(p.rating)}</span><b>${p.rating.toFixed(1)}</b><span>(${p.reviews})</span></div>` : '';
    /* Three states, not two. A discontinued product keeps its card and page but
       shows no price — quoting a price for something that cannot be bought is
       worse than showing nothing. */
    const foot = p.status === 'discontinued'
      ? `<div class="foot"><span class="chip">${t('cats.discontinued')}</span></div>`
      : future
        ? `<div class="foot"><span class="chip">${t('cats.soon')}</span></div>`
        : `<div class="foot"><span class="price">${money(p.price)}</span><span class="btn btn-ghost btn-sm">${t('cta.view')}</span></div>`;
    return `
    <a class="prod-card" href="product.html?sku=${encodeURIComponent(p.sku)}" aria-label="${esc(tf(p.name))}">
      <div class="thumb">${badge}${thumb(p)}</div>
      <div class="body">
        <span class="cat-label">${cat ? esc(tf(cat.name)) + ' · ' : ''}${esc(p.sku)}</span>
        <h3>${esc(tf(p.name))}</h3>
        ${claimHtml(tf(p.claim), 3)}
        <div class="meta-chips">${qiChip(p)}${(p.mount || []).slice(0, 2).map((m) => `<span class="chip">${t('mount.' + m)}</span>`).join('')}</div>
        ${ratingHtml}
        ${foot}
      </div>
    </a>`;
  }
  function categoryCard(c) {
    const count = published.filter((p) => p.category === c.id).length;
    const future = c.status === 'future';
    return `
    <a class="cat-card" href="products.html?cat=${c.id}">
      ${future ? `<span class="soon">${t('cats.soon')}</span>` : ''}
      <div class="cat-art">${art(c.art, tf(c.name))}</div>
      <div>
        <div class="code">${c.cat}</div>
        <h3>${esc(tf(c.name))}</h3>
        <p>${esc(tf(c.desc))}</p>
        <div class="count">${future ? '' : `${count} ${t('cats.count')}`} ${icon('arrow')}</div>
      </div>
    </a>`;
  }
  /* The status badge ("Flagship" / "Expanding") and the S1..S6 code were dropped
     on 2026-08-17: they were leftovers from when scenarios were a product axis.
     To a visitor they said nothing — an internal priority label and an internal
     code — so the card now leads with the picture and the name. `scns.tag.*` stays
     in i18n.js in case the labels are wanted for an internal view. */
  function scenarioCard(s) {
    return `
    <a class="scn-card" href="scenarios.html#${s.id}">
      <div class="scn-icon">${icon(s.icon)}</div>
      <h3>${esc(tf(s.name))}</h3>
      <p>${esc(tf(s.desc))}</p>
    </a>`;
  }
  /* The five Insights categories. These strings are the DB's `category` values,
     so they must match the check constraint in
     supabase/migrations/*_insights_and_test_reports.sql exactly. Labels come
     from js/i18n.js under insights.cat.<value>. */
  const INSIGHT_CATS = [
    'Magnetic Technology',
    'Charging Standards',
    'Apple Ecosystem',
    'Industry Trends',
    'Tech Explained',
  ];

  function formatDate(iso) {
    if (!iso) return '';
    /* A date-only string is parsed as UTC midnight by `new Date()`, so west of
       Greenwich it renders as the PREVIOUS day. Build it in local time instead:
       these are editorial dates, not instants. */
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
    const d = parts ? new Date(+parts[1], +parts[2] - 1, +parts[3]) : new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    /* Follow the chosen content language, not the browser's locale — otherwise a
       Vietnamese page on an en-US browser prints an American date. */
    const locale = { en: 'en-GB', vi: 'vi-VN', id: 'id-ID', zh: 'zh-TW', 'zh-Hans': 'zh-CN' }[lang] || 'en-GB';
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /* Minimal article formatting for staff-authored bodies. Everything is escaped
     FIRST and only a fixed set of markers is then turned into markup, so no
     amount of HTML in the database can inject anything — /admin is trusted, but
     "trusted" is not a reason to hand it an XSS primitive on the public site.
     Supported: "## " headings, "- " list items, blank-line or heading-delimited
     paragraphs, **bold**, *italic*, and image lines:
     ![alt](https://example.com/photo.jpg){wide|left|right}.
     Processed line by line, NOT block by block: an author will write a heading
     immediately above its paragraph with no blank line between them, and a
     block-based reader emits that heading as literal "## " text. */
  function richText(src) {
    if (!src) return '';
    const safeImageUrl = (url) => {
      const u = String(url || '').trim();
      if (/^(https?:)?\/\//i.test(u) || u.charAt(0) === '/' || /^(?:\.\.?\/)?(?:assets|image)\//i.test(u)) return esc(u);
      return '';
    };
    const inline = (str) => esc(str)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    const out = [];
    let para = [];   // pending plain lines
    let list = [];   // pending list items
    const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
    const flushList = () => { if (list.length) { out.push('<ul>' + list.map((l) => `<li>${inline(l)}</li>`).join('') + '</ul>'); list = []; } };
    const flush = () => { flushPara(); flushList(); };

    String(src).split('\n').forEach((raw) => {
      const line = raw.trim();
      if (!line) { flush(); return; }
      const img = /^!\[([^\]]*)\]\(([^)]+)\)(?:\{(wide|left|right)\})?$/i.exec(line);
      if (img) {
        flush();
        const src = safeImageUrl(img[2]);
        if (!src) return;
        const layout = img[3] || 'wide';
        out.push(`<figure class="rich-image ${layout}"><img src="${src}" alt="${esc(img[1])}" loading="lazy"></figure>`);
        return;
      }
      if (/^##\s+/.test(line)) { flush(); out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`); return; }
      if (/^[-*]\s+/.test(line)) { flushPara(); list.push(line.replace(/^[-*]\s+/, '')); return; }
      flushList(); para.push(line);
    });
    flush();
    return out.join('');
  }

  function insightCard(a) {
    const excerpt = tf(a.excerpt);
    return `
    <a class="insight-card reveal" href="insight.html?slug=${encodeURIComponent(a.slug)}" aria-label="${esc(tf(a.title))}">
      <div class="thumb">${a.img ? `<img src="${esc(a.img)}" alt="" loading="lazy">` : art(a.art || 'ring')}</div>
      <div class="body">
        <span class="cat-label">${esc(t('insights.cat.' + a.cat))}</span>
        <h3>${esc(tf(a.title))}</h3>
        ${excerpt ? `<p class="claim">${esc(excerpt)}</p>` : ''}
        <div class="foot">
          ${a.date ? `<time datetime="${esc(a.date)}">${esc(formatDate(a.date))}</time>` : '<span></span>'}
          <span class="btn btn-ghost btn-sm">${t('insights.read')}</span>
        </div>
      </div>
    </a>`;
  }

  /* Test evidence for one product. Reports live in DB.reports and are referenced
     by id from p.reports, because one report can cover many SKUs — embedding it
     per product would duplicate the same prose into data.js repeatedly.
     A report with no file is still listed: the evidence claim is the content,
     the PDF is a bonus. Only reports that passed Public + approved_for_marketing
     are in DB.reports at all (gated in the export function). */
  function reportList(p) {
    const byId = new Map((window.DB.reports || []).map((r) => [r.id, r]));
    const rows = (p.reports || []).map((id) => byId.get(id)).filter(Boolean);
    if (!rows.length) return `<p class="evidence-empty">${t('pdp.evidenceNote')}</p>`;
    return `<ul class="evidence-list">${rows.map((r) => {
      const title = esc(tf(r.title));
      const meta = [
        r.type ? esc(t('test.type.' + r.type)) : '',
        r.level ? esc(t('test.level.' + r.level)) : '',
        r.date ? esc(formatDate(r.date)) : '',
      ].filter(Boolean).join(' · ');
      const summary = tf(r.summary);
      const limits = tf(r.limits);
      const head = r.file
        ? `<a class="evidence-title" href="${esc(r.file)}" target="_blank" rel="noopener">${title}${icon('external')}</a>`
        : `<span class="evidence-title">${title}</span>`;
      return `<li>
        ${head}
        ${meta ? `<span class="evidence-meta">${meta}</span>` : ''}
        ${summary ? `<p class="evidence-summary">${esc(summary)}</p>` : ''}
        ${limits ? `<p class="evidence-limits"><b>${t('pdp.limitations')}</b> ${esc(limits)}</p>` : ''}
      </li>`;
    }).join('')}</ul>`;
  }

  function faqItem(f) {
    return `
    <details class="faq-item">
      <summary>${esc(tf(f.q))}</summary>
      <div class="answer">${esc(tf(f.a))}</div>
    </details>`;
  }

  /* FAQ grouped by category with a small heading per group, instead of one flat
     list. The category column existed from day one and did nothing; at 7 entries
     a flat list was survivable, at 30 it would not be. Order follows FAQ_CATS so
     the sequence is editorial, not alphabetical or insertion order; anything with
     an unrecognised or empty category falls into a final "other" group rather
     than disappearing. */
  const FAQ_CATS = ['Installation', 'Compatibility', 'Charging', 'Heat', 'Warranty', 'Return'];

  function faqGroups(list) {
    const seen = new Set();
    const groups = FAQ_CATS.map((c) => ({
      cat: c,
      label: t('faq.cat.' + c),
      items: list.filter((f) => { if (f.cat === c) { seen.add(f.id); return true; } return false; }),
    })).filter((g) => g.items.length);
    const rest = list.filter((f) => !seen.has(f.id));
    if (rest.length) groups.push({ cat: '', label: t('faq.cat.other'), items: rest });

    /* One group and no meaningful split? Don't print a heading for the sake of it. */
    if (groups.length === 1) return groups[0].items.map(faqItem).join('');
    return groups.map((g) => `
      <div class="faq-group">
        <h3 class="faq-group-title">${esc(g.label)}</h3>
        ${g.items.map(faqItem).join('')}
      </div>`).join('');
  }

  /* Thumbnail strip under the main product image. Clicking swaps the main image
     rather than opening a lightbox: no keyboard/touch gesture code to get wrong,
     and it works the same on a phone. Returns '' when there is nothing to show,
     so the markup simply isn't there for a product with one photo. */
  function gallery(p) {
    const shots = [p.img].concat(p.gallery || []).filter(Boolean);
    if (shots.length < 2) return '';
    return `<div class="pdp-shots" role="group" aria-label="${esc(t('pdp.gallery'))}">${
      shots.map((src, i) => `
        <button type="button" class="pdp-shot${i === 0 ? ' active' : ''}" data-src="${esc(src)}"
                aria-label="${esc(t('pdp.gallery'))} ${i + 1}">
          <img src="${esc(src)}" alt="" loading="lazy">
        </button>`).join('')
    }</div>`;
  }

  /* ---------- boot ---------- */
  /* i18n copy may contain markup (<br>, <b>) because it is injected with
     innerHTML. A <title> and a meta description are plain text. */
  function stripTags(str) {
    return String(str == null ? '' : str).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  function applyI18nAttrs(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = t(el.getAttribute('data-i18n')); });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  }

  function boot() {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : lang;
    const active = document.body.dataset.page || '';
    document.body.insertAdjacentHTML('afterbegin', header(active));
    document.body.insertAdjacentHTML('beforeend', footer());
    /* Until 2026-07-29 this line overwrote the <title> of EVERY page with one
       generic string, so seven of eight pages were indistinguishable to a search
       engine and in a browser's tab bar or history. Compose from the copy each
       page already has translated instead of inventing 8 x 5 new strings; pages
       that build their own title (product, insight) opt out with
       data-keep-title="1" and set document.title in renderPage. */
    const PAGE_META = {
      products:  ['products.title', 'products.sub'],
      scenarios: ['scenarios.title', 'scenarios.sub'],
      why:       ['why.title', 'why.sub'],
      insights:  ['insights.title', 'insights.sub'],
      support:   ['support.title', 'support.sub'],
      dealers:   ['dealers.title', 'dealers.sub'],
      about:     ['about.title', 'about.sub'],
    };
    if (document.body.dataset.keepTitle !== '1') {
      const pm = PAGE_META[active];
      document.title = pm ? `${stripTags(t(pm[0]))} — VIEMAG` : t('meta.title');
      const descEl = document.querySelector('meta[name="description"]');
      if (descEl && pm) descEl.setAttribute('content', stripTags(t(pm[1])));
    }

    /* language menu */
    const langBtn = document.getElementById('langBtn');
    const langMenu = document.getElementById('langMenu');
    langBtn.addEventListener('click', () => {
      const open = langMenu.classList.toggle('open');
      langBtn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.lang-switch')) { langMenu.classList.remove('open'); langBtn.setAttribute('aria-expanded', 'false'); }
    });
    langMenu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

    /* mobile nav */
    const navToggle = document.getElementById('navToggle');
    const mainNav = document.getElementById('mainNav');
    navToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open);
      navToggle.innerHTML = icon(open ? 'close' : 'menu');
    });

    applyI18nAttrs(document);

    /* per-page render hook (injects dynamic .reveal content) */
    if (typeof window.renderPage === 'function') window.renderPage({ t, tf, icon, art, thumb, productCard, claimHtml, lines, categoryCard, scenarioCard, faqItem, faqGroups, insightCard, reportList, gallery, formatDate, richText, stripTags, INSIGHT_CATS, stars, money, esc, catById, prodBySku, published, applyI18nAttrs });

    /* scroll reveal — observe AFTER dynamic content exists so injected cards animate in */
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
