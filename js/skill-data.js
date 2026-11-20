// ARC Raiders 2.0 "Frozen Trail" skill tree data.
// Names, max ranks and per-rank values follow the 2.0 game data as reported by the community wiki.
// Checked against patch notes through 2.6.0 (Nov 17, 2026): no tree changes since 2.0.
// Each row: [name, maxRank, description, perRankValues?, note?, icon]
window.ARC = window.ARC || {};
const pct = a => a.map(v => v + "%");
ARC.BRANCHES = {
  c: { name: "Conditioning" },
  m: { name: "Mobility" },
  s: { name: "Survival" }
};
// slot order inside a branch: start, two early chains, fork pair, three late chains, three top skills
ARC.SLOTS = ["st","eh0","et0","eh1","et1","ch0","ch1","lh0","lt0","lh1","lt1","lh2","lt2","en0","en1","en2"];
ARC.SKILLS = {
 c:[
  ["Used To The Weight",1,"Wearing a shield slows you down less.",null,null,"shield"],
  ["Three Deep Breaths",5,"After an ability drains your stamina, you shake off exhaustion sooner.",null,"Rank 1: exhaustion ends at 18 stamina · Rank 5: at 10 stamina","lungs"],
  ["Vigorous Vaulter",1,"Being exhausted no longer slows your vaults.",null,null,"vault"],
  ["Stubborn Mule",5,"Extra weight you can carry before over-encumbrance slows stamina regen.",["+10","+15","+20","+25","+30"],null,"weight"],
  ["Vault 'n' Carry",1,"Vault while holding a carryable object.",null,null,"crate"],
  ["Mule's Gallop",1,"Sprint even while over-encumbered.",null,null,"gallop"],
  ["Back On Your Feet",1,"When critically hurt, your health regenerates up to a cap. The 2.0 update raised that cap to 40 (older listings say 30).",null,null,"heartUp"],
  ["Downed But Determined",5,"You bleed out more slowly while downed.",pct([5,10,15,20,25]),null,"heart"],
  ["Crawl Before You Walk",5,"You crawl faster while downed.",pct([10,20,30,40,50]),null,"crawl"],
  ["Broad Shoulders",5,"Raises your maximum carry weight.",["+2","+4","+6","+8","+10"],null,"backpack"],
  ["Speedy Mule",5,"Shrinks the movement penalty when severely over-encumbered.",pct([10,17.5,25,32.5,40]),null,"speedWeight"],
  ["Loaded Arms",1,"Your equipped weapon counts for less toward encumbrance.",null,null,"rifle"],
  ["Proficient Pryer",5,"Breaching doors and containers takes less time.",pct([5,10,15,20,30]),null,"crowbar"],
  ["Security Breach",1,"Lets you breach Security Lockers.",null,null,"lockOpen"],
  ["Weapon Bash",1,"Melee strike with the weapon in your hands. Uses the Activate Skill key (T by default).",null,null,"bash"],
  ["Bull Rush",1,"Sprint with your weapon stowed to knock players and ARC back. Uses the Activate Skill key (T by default).",null,null,"rush"]
 ],
 m:[
  ["Youthful Lungs",1,"Raises your maximum stamina.",null,null,"lungs"],
  ["Sure-Footed Scrambler",5,"Scramble up steep slopes for longer while sprinting.",["+0.5s","+0.8s","+1.2s","+1.6s","+2s"],null,"slope"],
  ["Ready To Roll",5,"Widens the timing window for a Recovery Roll when you fall.",pct([10,20,30,40,50]),null,"roll"],
  ["Nimble Climber",5,"Climb and vault faster.",pct([3,6,9,12,15]),null,"ladder"],
  ["Fight Or Flight",5,"Getting hurt in combat gives back a set amount of stamina, on a cooldown.",["+5","+10","+15","+20","+25"],null,"heartBolt"],
  ["Vault Spring",1,"Jump off the end of a vault.",null,null,"spring"],
  ["Vaults On Vaults On Vaults",1,"Vaulting costs no stamina.",null,null,"vaults"],
  ["Effortless Roll",5,"Dodge Rolls cost less stamina.",pct([7,14,21,27,34]),null,"roll"],
  ["Slip And Slide",5,"Slides go further and faster (less slide friction).",pct([5,10,15,20,25]),null,"slide"],
  ["Right Back At It",1,"Get back up faster after a heavy landing.",null,null,"land"],
  ["Off The Wall",5,"Wall Leaps cover more distance.",pct([10,20,30,40,50]),null,"wallLeap"],
  ["Marathon Runner",5,"Moving around costs less stamina.",pct([3,6,9,12,15]),null,"wind"],
  ["Swift Start",5,"The speed burst at the start of a sprint lasts longer (in-game units).",["+2.5","+4","+6","+7.5","+10"],null,"burst"],
  ["Sprinting On Fumes",1,"Sprinting can't fully drain your stamina. Any other action or taking damage ends it, and recovery time grows with how long you sprinted.",null,null,"fumes"],
  ["Wall Run",1,"Sprint at a wall to run a few steps up it.",null,null,"wallRun"],
  ["In The Flow",1,"Chaining movement moves while sprinting builds speed and cuts their stamina cost.",null,null,"flow"]
 ],
 s:[
  ["In-Round Crafting",1,"Craft items in the field while topside.",null,null,"craft"],
  ["Looter's Instincts",5,"Container loot is revealed faster.",pct([5,10,15,20,25]),null,"eye"],
  ["Silent Scavenger",5,"Looting makes less noise.",pct([10,20,30,40,50]),null,"mute"],
  ["Sturdy Ankles",5,"Less damage from non-lethal falls.",pct([3,6,9,12,15]),null,"boot"],
  ["Agile Croucher",5,"Move faster while crouched.",pct([3,6,9,12,15]),null,"crouch"],
  ["Quick Roll",1,"A faster Dodge Roll that costs less stamina but covers less ground.",null,null,"quickRoll"],
  ["Minesweeper",1,"Defuse mines and explosive deployables from close range.",null,null,"mine"],
  ["Gentle Pressure",5,"Breaching makes less noise.",pct([10,20,30,40,50]),null,"hush"],
  ["A Little Extra",1,"Breaching an object gives you resources.",null,null,"plusBox"],
  ["Traveling Tinkerer",1,"Adds more items to your field-crafting list.",null,null,"wrench"],
  ["Looter's Luck",5,"Chance to reveal two items at once while looting.",pct([6.6,13.2,19.8,26.4,33]),null,"clover"],
  ["Stylish Landing",5,"Recovery Roll works from higher falls.",["+0.5m","+0.8m","+1m","+1.2m","+1.5m"],null,"land"],
  ["Turtle Crawl",5,"Take less damage while downed.",pct([6.6,13.2,19.8,26.4,33]),null,"turtle"],
  ["Road Warrior",1,"More ammo and ARC Powercells from ARC, and full-efficiency recycling during a round.",null,null,"recycle"],
  ["Nomadic Crafting",1,"Field-craft a much wider range of items.",null,null,"anvil"],
  ["Field Repair",1,"Repair weapons, shields and gadgets up to 30% durability during a round.",null,null,"repair"]
 ]
};
ARC.EXAMPLE = {c0:1,c1:3,c3:5,c4:1,c5:1,c7:3,c9:5,c10:5,c11:1,c12:5,c13:1,
  m0:1,m1:1,m2:3,m3:5,m6:1,m11:5,
  s0:1,s1:5,s2:5,s5:1,s7:5,s8:1,s9:1,s10:3};
