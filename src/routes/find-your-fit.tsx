import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/find-your-fit")({
  head: () => ({ meta: [{ title: "Find your fit — Oakmonte" }] }),
  component: FindYourFitPage,
});

// Legacy parametric shape — still used by MALE_BODY_TYPES / NEUTRAL_BODY_TYPES
// until those get traced references too.
type ParametricBodyShape = {
  id: string;
  shoulder: number;
  bust: number;
  waist: number;
  hip: number;
  thigh: number;
};

// New traced shape — used by FEMALE_BODY_TYPES. `paths` holds every
// <path d="..."> from the traced SVG file, in original order — the arm/body
// separation, wrist creases, knee lines etc. only render correctly if all
// of them are included, not just the main outline.
type TracedBodyShape = {
  id: string;
  viewBox: string;
  paths: string[];
};

type BodyShape = ParametricBodyShape | TracedBodyShape;

function isTraced(shape: BodyShape): shape is TracedBodyShape {
  return "paths" in shape;
}

const FEMALE_BODY_TYPES: TracedBodyShape[] = [
  {
    id: "f-plus-moderate",
    viewBox: "0 0 1043 1508",
    paths: [
    "M 435 1427 L 433 1429 L 430 1428 L 417 1428 L 417 1429 L 418 1428 L 426 1428 L 433 1430 L 435 1428",
    "M 358 1424 L 359 1423 L 360 1424 L 364 1423 L 365 1427 L 361 1428 L 358 1425",
    "M 648 1024 L 644 1032 L 635 1040 L 639 1038 L 646 1031 L 648 1025",
    "M 393 1023 L 394 1028 L 397 1033 L 402 1038 L 405 1039 L 398 1033 L 393 1024",
    "M 576 1010 L 581 1016 L 582 1022 L 592 1032 L 582 1020 L 583 1016 L 577 1010",
    "M 463 1010 L 457 1017 L 459 1018 L 455 1025 L 448 1032 L 457 1024 L 459 1020 L 459 1016 L 464 1010",
    "M 659 997 L 648 1009 L 646 1014 L 659 998",
    "M 381 997 L 384 1002 L 393 1011 L 394 1014 L 391 1007 L 382 998",
    "M 778 807 L 779 806 L 781 807 L 780 816 L 773 819 L 771 814 L 777 807",
    "M 260 807 L 261 806 L 264 807 L 269 812 L 270 816 L 268 819 L 266 819 L 261 815 L 261 808",
    "M 255 786 L 256 785 L 260 786 L 270 794 L 271 798 L 270 799 L 264 795 L 256 787",
    "M 787 784 L 788 783 L 789 785 L 781 793 L 772 799 L 770 798 L 770 796 L 780 787 L 786 785",
    "M 249 776 L 250 775 L 251 778 L 250 779 L 249 777",
    "M 778 772 L 779 771 L 784 771 L 786 773 L 786 778 L 784 783 L 779 783 L 777 781 L 777 773",
    "M 257 772 L 262 771 L 264 773 L 265 776 L 264 781 L 262 783 L 258 783 L 256 781 L 256 773",
    "M 793 748 L 794 747 L 796 748 L 797 756 L 800 762 L 798 769 L 798 782 L 786 800 L 782 804 L 774 807 L 770 811 L 769 810 L 769 805 L 775 799 L 782 795 L 786 791 L 794 778 L 790 783 L 789 782 L 791 778 L 792 768 L 793 767 L 792 763 L 792 751 L 793 749",
    "M 246 748 L 247 747 L 249 748 L 249 763 L 248 764 L 249 767 L 249 781 L 257 792 L 272 804 L 273 808 L 271 811 L 268 807 L 258 803 L 244 782 L 244 771 L 242 762 L 245 756 L 246 749",
    "M 513 745 L 514 744 L 527 744 L 528 745 L 521 760 L 519 759 L 519 756 L 514 746",
    "M 516 587 L 517 586 L 524 586 L 525 587 L 524 589 L 518 589 L 517 588",
    "M 519 583 L 514 585 L 511 588 L 519 591 L 523 591 L 530 588 L 527 585 L 523 583 L 520 583",
    "M 730 487 L 709 498 L 714 497 L 726 491 L 729 488",
    "M 311 487 L 317 492 L 332 498 L 319 492 L 312 487",
    "M 370 469 L 371 468 L 373 469 L 373 489 L 361 507 L 360 503 L 370 470",
    "M 669 468 L 670 467 L 671 468 L 672 474 L 675 481 L 676 488 L 681 503 L 680 507 L 668 490 L 668 472 L 669 469",
    "M 513 258 L 519 261 L 523 261 L 528 259 L 528 258 L 523 260 L 514 259",
    "M 601 241 L 600 242 L 594 242 L 566 248 L 556 249 L 545 252 L 541 255 L 552 251 L 577 247 L 603 241 L 602 241",
    "M 439 241 L 450 244 L 455 244 L 466 247 L 487 250 L 500 254 L 492 250 L 440 241",
    "M 593 110 L 590 112 L 586 121 L 587 135 L 583 141 L 586 139 L 588 135 L 588 127 L 587 126 L 588 118 L 593 111 L 595 112 L 595 110 L 594 110",
    "M 448 110 L 447 113 L 449 110 L 454 117 L 456 123 L 454 127 L 454 135 L 456 139 L 459 141 L 454 132 L 456 125 L 456 120 L 453 113 L 449 110",
    "M 509 23 L 510 22 L 532 22 L 546 26 L 558 32 L 574 47 L 583 63 L 587 80 L 587 100 L 586 101 L 585 112 L 587 111 L 590 106 L 594 105 L 598 111 L 598 122 L 593 139 L 588 149 L 585 152 L 580 151 L 577 164 L 568 180 L 570 182 L 570 201 L 573 214 L 574 215 L 575 211 L 583 217 L 593 222 L 620 232 L 625 235 L 653 238 L 664 241 L 677 247 L 690 256 L 698 264 L 707 276 L 718 297 L 726 321 L 731 344 L 740 416 L 749 459 L 756 480 L 762 488 L 769 501 L 777 523 L 785 559 L 785 565 L 786 566 L 786 572 L 788 579 L 788 585 L 789 586 L 793 615 L 807 673 L 808 683 L 821 744 L 821 750 L 818 760 L 818 765 L 813 789 L 803 801 L 785 818 L 782 814 L 783 809 L 787 802 L 792 797 L 801 782 L 800 776 L 801 775 L 802 761 L 799 754 L 798 749 L 799 747 L 793 743 L 797 730 L 792 738 L 790 745 L 789 774 L 787 777 L 786 772 L 783 770 L 780 770 L 777 772 L 776 776 L 775 775 L 776 747 L 769 721 L 769 706 L 774 685 L 774 679 L 772 684 L 760 656 L 736 614 L 729 594 L 713 560 L 687 517 L 678 482 L 669 455 L 669 439 L 677 430 L 683 419 L 687 406 L 688 388 L 687 387 L 687 380 L 681 360 L 668 336 L 669 335 L 670 320 L 667 304 L 667 331 L 665 332 L 659 324 L 680 365 L 685 386 L 685 401 L 681 417 L 675 428 L 663 440 L 646 449 L 626 453 L 604 452 L 586 447 L 572 440 L 562 433 L 544 415 L 533 395 L 526 368 L 524 348 L 525 369 L 530 390 L 534 400 L 547 421 L 555 430 L 567 440 L 584 449 L 606 455 L 632 455 L 653 449 L 664 442 L 666 443 L 666 448 L 667 449 L 667 463 L 666 464 L 666 473 L 665 474 L 666 495 L 667 494 L 705 551 L 728 599 L 738 628 L 744 650 L 749 676 L 751 698 L 752 699 L 752 714 L 753 715 L 752 754 L 751 755 L 751 763 L 750 764 L 748 782 L 743 802 L 743 806 L 741 810 L 739 821 L 731 845 L 731 848 L 713 903 L 711 906 L 697 946 L 685 975 L 688 971 L 689 972 L 688 986 L 687 987 L 687 993 L 686 994 L 686 1000 L 685 1001 L 682 1023 L 684 1024 L 686 1030 L 692 1061 L 692 1068 L 693 1069 L 694 1090 L 695 1091 L 694 1123 L 693 1124 L 693 1131 L 692 1132 L 690 1150 L 684 1176 L 657 1262 L 649 1301 L 649 1316 L 651 1323 L 651 1334 L 650 1339 L 649 1340 L 647 1337 L 647 1339 L 661 1376 L 668 1390 L 675 1401 L 675 1404 L 680 1409 L 683 1415 L 683 1421 L 680 1423 L 677 1423 L 680 1424 L 682 1422 L 683 1424 L 679 1428 L 677 1428 L 675 1426 L 675 1423 L 672 1416 L 667 1411 L 674 1424 L 672 1426 L 669 1425 L 666 1426 L 666 1427 L 667 1426 L 672 1426 L 674 1428 L 670 1433 L 664 1433 L 663 1432 L 663 1427 L 659 1418 L 653 1412 L 658 1419 L 661 1427 L 660 1428 L 653 1428 L 651 1430 L 655 1428 L 659 1428 L 661 1430 L 661 1434 L 657 1437 L 651 1437 L 649 1435 L 646 1423 L 638 1413 L 646 1429 L 645 1430 L 637 1429 L 634 1431 L 640 1429 L 644 1430 L 646 1432 L 646 1436 L 643 1439 L 640 1440 L 635 1440 L 629 1435 L 629 1428 L 627 1424 L 618 1415 L 616 1411 L 618 1418 L 625 1427 L 624 1428 L 623 1427 L 614 1427 L 607 1429 L 605 1427 L 607 1430 L 612 1428 L 623 1428 L 626 1430 L 626 1435 L 621 1440 L 618 1441 L 605 1441 L 600 1439 L 594 1432 L 593 1424 L 592 1423 L 590 1424 L 587 1421 L 585 1416 L 585 1402 L 587 1394 L 586 1384 L 585 1384 L 585 1390 L 584 1391 L 580 1385 L 580 1373 L 584 1352 L 584 1341 L 581 1330 L 581 1319 L 583 1311 L 581 1278 L 571 1233 L 553 1172 L 548 1147 L 547 1133 L 546 1132 L 545 1090 L 546 1089 L 546 1078 L 547 1077 L 548 1060 L 550 1051 L 551 1031 L 540 1001 L 535 979 L 532 947 L 531 946 L 528 914 L 527 913 L 527 905 L 526 904 L 526 896 L 525 895 L 524 875 L 523 874 L 523 859 L 522 858 L 522 768 L 527 752 L 530 746 L 534 742 L 537 742 L 553 734 L 579 717 L 606 697 L 641 668 L 670 639 L 634 673 L 591 707 L 553 731 L 537 739 L 525 742 L 516 742 L 504 739 L 488 731 L 452 708 L 402 668 L 373 640 L 402 669 L 437 698 L 482 730 L 502 741 L 507 742 L 510 745 L 515 754 L 519 768 L 519 847 L 518 848 L 518 866 L 517 867 L 515 898 L 513 907 L 513 915 L 512 916 L 512 923 L 511 924 L 511 931 L 509 940 L 506 972 L 499 1003 L 488 1030 L 489 1053 L 491 1062 L 491 1070 L 493 1080 L 493 1093 L 494 1094 L 494 1119 L 493 1120 L 492 1140 L 483 1183 L 476 1204 L 475 1211 L 471 1221 L 462 1255 L 458 1275 L 457 1289 L 456 1290 L 456 1313 L 458 1321 L 458 1330 L 455 1340 L 455 1353 L 459 1373 L 459 1386 L 456 1390 L 454 1384 L 453 1387 L 455 1416 L 453 1421 L 449 1425 L 448 1424 L 447 1425 L 445 1434 L 440 1439 L 435 1441 L 422 1441 L 419 1440 L 414 1434 L 414 1429 L 416 1425 L 423 1418 L 424 1411 L 422 1415 L 412 1426 L 411 1436 L 405 1440 L 397 1439 L 394 1435 L 394 1432 L 396 1430 L 407 1431 L 403 1429 L 398 1430 L 395 1429 L 396 1425 L 403 1413 L 396 1420 L 392 1430 L 392 1435 L 389 1437 L 384 1437 L 379 1432 L 380 1428 L 389 1429 L 380 1427 L 381 1422 L 387 1413 L 380 1420 L 377 1432 L 374 1434 L 369 1432 L 367 1429 L 367 1422 L 374 1410 L 369 1415 L 365 1424 L 360 1423 L 357 1419 L 359 1412 L 366 1404 L 366 1402 L 380 1376 L 392 1341 L 394 1338 L 391 1341 L 390 1340 L 391 1301 L 384 1266 L 358 1183 L 353 1163 L 352 1154 L 350 1149 L 347 1122 L 346 1121 L 346 1109 L 345 1108 L 346 1078 L 347 1077 L 347 1070 L 348 1069 L 348 1063 L 349 1062 L 352 1041 L 354 1036 L 356 1024 L 358 1023 L 358 1015 L 357 1014 L 357 1007 L 356 1006 L 352 972 L 353 971 L 356 975 L 342 942 L 329 904 L 327 901 L 310 850 L 296 799 L 290 767 L 289 748 L 288 747 L 288 705 L 289 704 L 291 679 L 296 653 L 302 630 L 310 606 L 320 582 L 331 560 L 345 536 L 368 503 L 373 494 L 375 496 L 375 489 L 376 488 L 376 474 L 375 473 L 375 460 L 374 459 L 375 458 L 375 443 L 377 442 L 384 447 L 391 450 L 411 455 L 439 454 L 453 450 L 468 443 L 481 434 L 493 422 L 503 408 L 509 396 L 514 381 L 517 366 L 518 349 L 517 350 L 517 358 L 516 359 L 514 377 L 507 398 L 497 415 L 481 431 L 468 440 L 456 446 L 435 452 L 409 452 L 399 450 L 383 443 L 377 439 L 368 430 L 361 417 L 358 407 L 357 388 L 361 369 L 367 354 L 383 324 L 379 330 L 376 332 L 375 331 L 375 304 L 372 318 L 373 338 L 361 361 L 355 382 L 356 411 L 362 426 L 373 439 L 371 460 L 362 486 L 361 493 L 356 507 L 353 520 L 346 529 L 330 556 L 313 591 L 304 617 L 284 651 L 274 671 L 269 684 L 268 680 L 267 680 L 268 690 L 272 704 L 272 723 L 267 738 L 266 750 L 265 751 L 267 773 L 266 774 L 263 771 L 260 770 L 257 771 L 255 778 L 253 775 L 252 770 L 251 742 L 249 736 L 245 730 L 248 740 L 248 744 L 242 748 L 244 749 L 241 760 L 239 762 L 241 769 L 241 783 L 258 807 L 259 815 L 257 818 L 240 803 L 228 788 L 223 758 L 220 749 L 236 667 L 249 614 L 258 553 L 264 527 L 272 504 L 288 475 L 288 472 L 293 459 L 297 443 L 301 417 L 302 416 L 303 403 L 304 402 L 304 395 L 305 394 L 310 350 L 314 330 L 321 305 L 332 281 L 340 269 L 350 258 L 365 247 L 378 241 L 389 238 L 417 235 L 444 224 L 460 216 L 467 211 L 468 212 L 467 215 L 468 215 L 471 204 L 472 181 L 473 179 L 467 168 L 464 159 L 463 151 L 458 152 L 454 148 L 450 140 L 445 124 L 445 110 L 449 105 L 451 105 L 454 108 L 455 111 L 457 112 L 456 100 L 455 99 L 456 75 L 459 64 L 466 50 L 479 36 L 486 31 L 496 26 L 508 23",
    "M 512 19 L 499 22 L 484 29 L 478 33 L 467 44 L 457 61 L 454 71 L 453 83 L 452 84 L 453 102 L 446 104 L 442 111 L 442 122 L 447 139 L 453 151 L 456 154 L 461 156 L 464 168 L 469 177 L 469 198 L 467 207 L 456 215 L 417 232 L 385 236 L 373 240 L 361 246 L 349 255 L 341 263 L 331 277 L 324 290 L 312 326 L 308 346 L 307 358 L 306 359 L 299 417 L 290 460 L 284 478 L 278 486 L 268 506 L 259 535 L 253 567 L 253 572 L 252 573 L 248 604 L 243 629 L 241 634 L 241 638 L 232 672 L 228 697 L 226 702 L 223 721 L 218 740 L 218 753 L 221 762 L 226 791 L 238 805 L 255 821 L 262 819 L 266 822 L 269 822 L 272 819 L 272 814 L 275 810 L 275 804 L 273 801 L 274 799 L 273 794 L 271 791 L 264 786 L 269 777 L 268 746 L 275 720 L 275 706 L 271 686 L 277 671 L 297 634 L 298 637 L 292 658 L 289 680 L 288 681 L 286 711 L 285 712 L 285 742 L 286 743 L 288 771 L 289 772 L 292 793 L 296 806 L 296 810 L 306 843 L 306 846 L 310 856 L 310 859 L 313 865 L 314 871 L 336 934 L 349 964 L 352 997 L 355 1011 L 355 1020 L 352 1029 L 352 1033 L 346 1058 L 344 1080 L 343 1081 L 343 1118 L 344 1119 L 344 1127 L 345 1128 L 345 1135 L 351 1166 L 362 1206 L 369 1225 L 369 1228 L 381 1265 L 385 1281 L 385 1286 L 388 1298 L 388 1306 L 389 1307 L 389 1313 L 387 1321 L 388 1347 L 377 1376 L 363 1403 L 356 1412 L 355 1415 L 355 1425 L 359 1430 L 365 1431 L 370 1436 L 378 1436 L 384 1440 L 388 1440 L 392 1438 L 397 1442 L 407 1442 L 413 1438 L 420 1443 L 433 1444 L 438 1443 L 445 1439 L 449 1432 L 449 1429 L 456 1422 L 458 1416 L 458 1406 L 456 1400 L 456 1395 L 459 1392 L 462 1385 L 462 1374 L 461 1373 L 461 1368 L 458 1355 L 458 1348 L 457 1347 L 461 1329 L 461 1322 L 458 1308 L 459 1288 L 460 1287 L 461 1274 L 465 1254 L 485 1186 L 494 1146 L 495 1131 L 496 1130 L 496 1118 L 497 1117 L 497 1097 L 496 1096 L 495 1071 L 494 1070 L 492 1045 L 491 1044 L 491 1031 L 502 1003 L 508 978 L 511 949 L 512 948 L 512 940 L 513 939 L 513 931 L 514 930 L 514 922 L 517 906 L 519 879 L 520 878 L 522 886 L 522 896 L 523 897 L 524 913 L 525 914 L 526 929 L 528 937 L 528 946 L 529 947 L 530 964 L 531 965 L 533 984 L 538 1005 L 548 1031 L 547 1053 L 546 1054 L 544 1081 L 543 1082 L 543 1094 L 542 1095 L 542 1116 L 543 1117 L 543 1129 L 544 1130 L 545 1146 L 548 1158 L 548 1163 L 552 1176 L 552 1180 L 573 1252 L 573 1256 L 577 1271 L 578 1284 L 579 1285 L 580 1312 L 578 1320 L 578 1329 L 581 1340 L 581 1354 L 577 1375 L 577 1384 L 579 1390 L 584 1395 L 582 1404 L 582 1416 L 585 1423 L 591 1429 L 593 1436 L 598 1441 L 602 1443 L 616 1444 L 623 1442 L 627 1438 L 633 1442 L 642 1442 L 648 1438 L 652 1440 L 659 1439 L 663 1435 L 669 1436 L 676 1431 L 681 1430 L 685 1426 L 686 1423 L 685 1412 L 678 1403 L 665 1378 L 652 1345 L 653 1340 L 653 1319 L 652 1318 L 651 1308 L 652 1307 L 653 1292 L 659 1265 L 687 1175 L 696 1129 L 697 1081 L 696 1080 L 696 1071 L 695 1070 L 693 1050 L 686 1021 L 686 1011 L 690 991 L 692 964 L 712 914 L 733 851 L 733 848 L 739 831 L 747 801 L 753 769 L 754 751 L 755 750 L 755 704 L 754 703 L 754 693 L 753 692 L 753 684 L 752 683 L 750 665 L 744 639 L 742 635 L 743 633 L 759 660 L 770 686 L 770 692 L 768 697 L 767 708 L 766 709 L 766 716 L 767 717 L 767 725 L 773 744 L 772 775 L 774 782 L 777 785 L 768 794 L 768 802 L 766 805 L 766 810 L 769 814 L 769 818 L 771 821 L 774 822 L 779 819 L 784 821 L 788 820 L 802 807 L 816 790 L 816 785 L 819 774 L 820 764 L 823 755 L 824 745 L 816 708 L 815 698 L 811 684 L 809 669 L 802 643 L 802 639 L 800 634 L 800 630 L 794 605 L 784 539 L 774 506 L 767 491 L 757 475 L 750 452 L 742 411 L 733 340 L 728 318 L 721 297 L 714 282 L 705 268 L 692 254 L 681 246 L 669 240 L 657 236 L 647 235 L 646 234 L 638 234 L 637 233 L 629 233 L 598 221 L 584 214 L 574 206 L 573 201 L 573 178 L 579 166 L 581 157 L 589 152 L 594 143 L 598 133 L 601 118 L 600 109 L 598 105 L 595 103 L 590 104 L 589 103 L 590 81 L 587 66 L 584 58 L 577 46 L 570 38 L 560 30 L 551 25 L 536 20 L 513 19",
    ],
  },
];

const MALE_BODY_TYPES: ParametricBodyShape[] = [
  { id: "m1", shoulder: 0.45, bust: 0.4, waist: 0.38, hip: 0.4, thigh: 0.38 },
  { id: "m2", shoulder: 0.55, bust: 0.48, waist: 0.42, hip: 0.45, thigh: 0.42 },
  { id: "m3", shoulder: 0.68, bust: 0.58, waist: 0.45, hip: 0.5, thigh: 0.48 },
  { id: "m4", shoulder: 0.85, bust: 0.75, waist: 0.48, hip: 0.55, thigh: 0.58 },
  { id: "m5", shoulder: 0.65, bust: 0.65, waist: 0.68, hip: 0.62, thigh: 0.55 },
  { id: "m6", shoulder: 0.68, bust: 0.75, waist: 0.82, hip: 0.68, thigh: 0.6 },
  { id: "m7", shoulder: 0.72, bust: 0.88, waist: 0.95, hip: 0.78, thigh: 0.68 },
];

const NEUTRAL_BODY_TYPES: ParametricBodyShape[] = [
  { id: "n1", shoulder: 0.5, bust: 0.5, waist: 0.42, hip: 0.5, thigh: 0.45 },
  { id: "n2", shoulder: 0.65, bust: 0.55, waist: 0.48, hip: 0.55, thigh: 0.5 },
  { id: "n3", shoulder: 0.55, bust: 0.6, waist: 0.42, hip: 0.68, thigh: 0.58 },
  { id: "n4", shoulder: 0.78, bust: 0.62, waist: 0.55, hip: 0.6, thigh: 0.55 },
  { id: "n5", shoulder: 0.6, bust: 0.55, waist: 0.55, hip: 0.6, thigh: 0.55 },
];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

// Legacy parametric silhouette — male/neutral only, for now.
function ParametricBodySilhouette({ shoulder, bust, waist, hip, thigh }: ParametricBodyShape) {
  const cx = 30;
  const w = (v: number) => 8 + v * 24;

  const sh = w(shoulder);
  const bu = w(bust);
  const wa = w(waist);
  const hi = w(hip);
  const th = w(thigh);

  const shoulderY = 20;
  const bustY = 36;
  const waistY = 58;
  const hipY = 78;
  const thighY = 96;
  const ankleY = 132;

  const path = `
    M ${cx - sh} ${shoulderY}
    C ${cx - sh} ${shoulderY + 8}, ${cx - bu} ${bustY - 6}, ${cx - bu} ${bustY}
    C ${cx - bu} ${bustY + 8}, ${cx - wa} ${waistY - 10}, ${cx - wa} ${waistY}
    C ${cx - wa} ${waistY + 8}, ${cx - hi} ${hipY - 8}, ${cx - hi} ${hipY}
    C ${cx - hi} ${hipY + 6}, ${cx - th} ${thighY - 6}, ${cx - th} ${thighY}
    L ${cx - th * 0.35} ${thighY + 6}
    L ${cx - hi * 0.12} ${ankleY}
    L ${cx + hi * 0.12} ${ankleY}
    L ${cx + th * 0.35} ${thighY + 6}
    L ${cx + th} ${thighY}
    C ${cx + th} ${thighY - 6}, ${cx + hi} ${hipY + 6}, ${cx + hi} ${hipY}
    C ${cx + hi} ${hipY - 8}, ${cx + wa} ${waistY + 8}, ${cx + wa} ${waistY}
    C ${cx + wa} ${waistY - 10}, ${cx + bu} ${bustY + 8}, ${cx + bu} ${bustY}
    C ${cx + bu} ${bustY - 6}, ${cx + sh} ${shoulderY + 8}, ${cx + sh} ${shoulderY}
    Z
  `;

  return (
    <svg viewBox="0 0 60 132" className="w-11 h-16 shrink-0" fill="none" aria-hidden="true">
      <circle cx={cx} cy={9} r={7} stroke="currentColor" strokeWidth="1.4" />
      <path d={path} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

// New traced silhouette — female, and eventually all genders.
// Renders every path from the source file, so the arm/torso separation and
// interior detail lines (creases, folds) show exactly as traced.
function TracedBodySilhouette({ viewBox, paths }: TracedBodyShape) {
  const strokeScale = Number(viewBox.split(" ")[2]) || 1043;
  return (
    <svg viewBox={viewBox} className="w-28 h-52 shrink-0" fill="none" aria-hidden="true">
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="currentColor"
          strokeWidth={Math.max(1, strokeScale / 700)}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function FindYourFitPage() {
  const navigate = useNavigate();

  const [heightUnit, setHeightUnit] = useState<"cm" | "ftin">("cm");
  const [heightCm, setHeightCm] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");

  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [weight, setWeight] = useState("");

  const [gender, setGender] = useState("");
  const [bodyType, setBodyType] = useState<string | null>(null);

  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [bust, setBust] = useState("");
  const [waistMeasurement, setWaistMeasurement] = useState("");
  const [hips, setHips] = useState("");
  const [shoulderWidth, setShoulderWidth] = useState("");

  const bodyTypeOptions: BodyShape[] =
    gender === "Female" ? FEMALE_BODY_TYPES
    : gender === "Male" ? MALE_BODY_TYPES
    : NEUTRAL_BODY_TYPES;

  const handleGenderChange = (value: string) => {
    setGender(value);
    setBodyType(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const height = heightUnit === "cm"
      ? { unit: "cm", value: heightCm }
      : { unit: "ftin", feet: heightFt, inches: heightIn };

    sessionStorage.setItem(
      "oakmonte_creator_fit",
      JSON.stringify({
        height,
        weight: { unit: weightUnit, value: weight },
        gender: gender || null,
        bodyType,
        measurements: measurementsOpen
          ? { bust, waist: waistMeasurement, hips, shoulderWidth }
          : null,
      })
    );

    navigate({ to: "/" });
  };

  const handleSkip = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link to="/creator-niche" className="text-[11px] uppercase tracking-widest hover:text-brand-accent transition-colors">
          ← Back
        </Link>
        <button
          type="button"
          onClick={handleSkip}
          className="text-[11px] uppercase tracking-widest text-brand-text/60 hover:text-brand-text transition-colors"
        >
          Skip
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">Find your fit</h1>
          <p className="text-sm text-brand-text/70 mb-8">
            Let us recommend pieces exactly your size.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <div className="flex items-center justify-end gap-3 mb-1.5 px-1">
                <button
                  type="button"
                  onClick={() => setHeightUnit("cm")}
                  className={`text-[11px] uppercase tracking-widest transition-colors ${heightUnit === "cm" ? "text-brand-accent" : "text-brand-text/40"}`}
                >
                  cm
                </button>
                <button
                  type="button"
                  onClick={() => setHeightUnit("ftin")}
                  className={`text-[11px] uppercase tracking-widest transition-colors ${heightUnit === "ftin" ? "text-brand-accent" : "text-brand-text/40"}`}
                >
                  ft/in
                </button>
              </div>
              {heightUnit === "cm" ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={heightCm}
                  onChange={(e) => setHeightCm(onlyDigits(e.target.value))}
                  placeholder="Height (cm)"
                  className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                />
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={heightFt}
                    onChange={(e) => setHeightFt(onlyDigits(e.target.value))}
                    placeholder="Feet"
                    className="flex-1 rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={heightIn}
                    onChange={(e) => setHeightIn(onlyDigits(e.target.value))}
                    placeholder="Inches"
                    className="flex-1 rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-end gap-3 mb-1.5 px-1">
                <button
                  type="button"
                  onClick={() => setWeightUnit("kg")}
                  className={`text-[11px] uppercase tracking-widest transition-colors ${weightUnit === "kg" ? "text-brand-accent" : "text-brand-text/40"}`}
                >
                  kg
                </button>
                <button
                  type="button"
                  onClick={() => setWeightUnit("lbs")}
                  className={`text-[11px] uppercase tracking-widest transition-colors ${weightUnit === "lbs" ? "text-brand-accent" : "text-brand-text/40"}`}
                >
                  lbs
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={weight}
                onChange={(e) => setWeight(onlyDigits(e.target.value))}
                placeholder={weightUnit === "kg" ? "Weight (kg)" : "Weight (lbs)"}
                className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
              />
            </div>

            <select
              value={gender}
              onChange={(e) => handleGenderChange(e.target.value)}
              className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm text-brand-text/80 focus:outline-none focus:border-brand-accent transition-colors"
            >
              <option value="">Gender (optional)</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>

            <div className="rounded-2xl border border-brand-text/15 overflow-hidden text-left">
              <button
                type="button"
                onClick={() => setMeasurementsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-brand-text/80 hover:bg-brand-text/5 transition-colors"
              >
                <span>Optional — add specific measurements</span>
                <span className={`transition-transform duration-200 ${measurementsOpen ? "rotate-90" : ""}`}>›</span>
              </button>
              {measurementsOpen && (
                <div className="px-5 pb-4 space-y-3 border-t border-brand-text/10 pt-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={bust}
                    onChange={(e) => setBust(onlyDigits(e.target.value))}
                    placeholder={gender === "Male" ? "Chest (cm)" : "Bust (cm)"}
                    className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={waistMeasurement}
                    onChange={(e) => setWaistMeasurement(onlyDigits(e.target.value))}
                    placeholder="Waist (cm)"
                    className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={hips}
                    onChange={(e) => setHips(onlyDigits(e.target.value))}
                    placeholder="Hips (cm)"
                    className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={shoulderWidth}
                    onChange={(e) => setShoulderWidth(onlyDigits(e.target.value))}
                    placeholder="Shoulder width (cm)"
                    className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>
              )}
            </div>

            <div className="pt-4 text-left">
              <p className="text-sm text-brand-text/70 mb-3">Pick a close resembling body type.</p>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
                {bodyTypeOptions.map((option) => {
                  const isSelected = bodyType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setBodyType(option.id)}
                      aria-label={`Body type option ${option.id}`}
                      className={`flex items-center justify-center rounded-xl border py-3 px-3 shrink-0 snap-start transition-all duration-200 ${
                        isSelected
                          ? "bg-brand-text text-brand-bg border-brand-text"
                          : "bg-transparent text-brand-text border-brand-text/25 hover:border-brand-text/50"
                      }`}
                    >
                      {isTraced(option) ? (
                        <TracedBodySilhouette {...option} />
                      ) : (
                        <ParametricBodySilhouette {...option} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-brand-text/50 px-2 pt-2">
              The information collected here is strictly for content and piece
              recommendation and is not meant to be or seem intrusive or abusive
              in any way.
            </p>

            <button
              type="submit"
              className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 mt-2"
            >
              Next
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}